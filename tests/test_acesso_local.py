"""Self-host protections: CSRF, security headers, internal files, optional
access password (scrypt hash, signed cookie, attempt limit) and the Gaming
Edition input validation."""
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import acesso_local as al
import gaming_api
from gaming import library

SENHA = "senha-de-teste-123"


@pytest.fixture()
def out(tmp_path, monkeypatch):
    monkeypatch.setitem(gaming_api._STATE, "output_dir", str(tmp_path))
    monkeypatch.setitem(gaming_api._STATE, "jobs", {})
    monkeypatch.delenv(al.ENV_SENHA, raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.setattr(al, "LIMITE", al.LimiteTentativas())
    return str(tmp_path)


@pytest.fixture()
def client(out):
    app = FastAPI()
    app.include_router(gaming_api.router)
    app.include_router(al.criar_router())

    @app.get("/health")
    def health():
        return {"status": "ok"}

    app.add_middleware(al.ProtecaoLocal)
    return TestClient(app)


# ---- password hash / session ------------------------------------------------
def test_hash_is_salted_and_verifies():
    h1, h2 = al.gerar_hash(SENHA), al.gerar_hash(SENHA)
    assert h1 != h2 and h1.startswith("scrypt$") and SENHA not in h1
    assert al.conferir_senha(SENHA, h1)
    assert not al.conferir_senha("senha-errada-999", h1)
    assert not al.conferir_senha(SENHA, "lixo")


def test_short_password_is_refused():
    with pytest.raises(ValueError):
        al.gerar_hash("curta")


def test_session_is_signed_and_expires():
    s = al.criar_sessao()
    assert al.sessao_valida(s)
    exp, nonce, sig = s.split(".")
    assert not al.sessao_valida(f"{int(exp) + 999}.{nonce}.{sig}")      # tampered expiry
    assert not al.sessao_valida(s, agora=time.time() + al.SESSAO_SEGUNDOS + 5)
    assert not al.sessao_valida("") and not al.sessao_valida("a.b")


def test_attempt_limit_per_address_and_total():
    lim = al.LimiteTentativas(por_ip=3, total=5, janela=60)
    for _ in range(3):
        assert lim.bloqueado("1.1.1.1", agora=100) == 0
        lim.falhou("1.1.1.1", agora=100)
    assert lim.bloqueado("1.1.1.1", agora=100) > 0
    assert lim.bloqueado("2.2.2.2", agora=100) == 0
    lim.falhou("2.2.2.2", agora=100); lim.falhou("3.3.3.3", agora=100)
    assert lim.bloqueado("4.4.4.4", agora=100) > 0                    # total reached
    assert lim.bloqueado("1.1.1.1", agora=200) == 0                   # window passed


# ---- middleware ---------------------------------------------------------------
def test_security_headers_on_every_response(client):
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert "strict-transport-security" not in r.headers               # plain http on localhost


def test_hsts_only_over_https(client):
    r = client.get("/health", headers={"X-Forwarded-Proto": "https"})
    assert r.headers["strict-transport-security"].startswith("max-age=")


@pytest.mark.parametrize("headers", [
    {"Sec-Fetch-Site": "cross-site", "Origin": "https://site-malicioso.example"},
    {"Origin": "https://site-malicioso.example"},
    {"Origin": "null"},
])
def test_writes_from_other_sites_are_refused(client, headers):
    r = client.post("/api/games", json={"name": "Jogo X"}, headers=headers)
    assert r.status_code == 403


@pytest.mark.parametrize("headers", [
    {},                                                               # curl / internal call
    {"Sec-Fetch-Site": "same-origin", "Origin": "http://localhost:5175"},
    {"Origin": "http://localhost:5175"},
    {"Sec-Fetch-Site": "same-origin", "Origin": "https://meu-codespace-5173.app.github.dev"},
])
def test_writes_from_the_panel_pass(client, headers):
    r = client.post("/api/games", json={"name": "Jogo Y"}, headers=headers)
    assert r.status_code == 200, r.text


def test_extra_origin_from_env(client, monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://192.168.0.10:5175")
    r = client.post("/api/games", json={"name": "Jogo Z"}, headers={"Origin": "http://192.168.0.10:5175"})
    assert r.status_code == 200


def test_reads_from_other_sites_still_work_without_cors(client):
    # GET is harmless by itself; the browser keeps the answer from the other
    # site because CORS only allows the panel origins (checked in app.py).
    assert client.get("/api/games", headers={"Origin": "https://x.example"}).status_code == 200


@pytest.mark.parametrize("path", ["/videos/gaming/publications.json", "/videos/gaming/games.json", "/videos/.instance",
                                  "/videos/abc/.resume.json"])
def test_internal_files_are_not_served(client, path):
    assert client.get(path).status_code == 404


# ---- optional password ------------------------------------------------------
def test_without_password_everything_is_open(client):
    assert client.get("/api/acesso/estado").json() == {"exige_senha": False, "autenticado": True}
    assert client.get("/api/games").status_code == 200


def test_password_flow(client, monkeypatch):
    monkeypatch.setenv(al.ENV_SENHA, al.gerar_hash(SENHA))
    r = client.get("/api/games")
    assert r.status_code == 401 and r.json()["code"] == "acesso_necessario"
    assert client.get("/videos/x/clip.mp4").status_code == 401
    assert client.get("/health").status_code == 200
    assert client.get("/api/acesso/estado").json() == {"exige_senha": True, "autenticado": False}

    assert client.post("/api/acesso/entrar", json={"senha": "errada-errada"}).status_code == 401
    r = client.post("/api/acesso/entrar", json={"senha": SENHA})
    assert r.status_code == 200
    ck = r.headers["set-cookie"].lower()
    assert "httponly" in ck and "samesite=strict" in ck and "secure" not in ck
    assert client.get("/api/games").status_code == 200

    client.post("/api/acesso/sair")
    assert client.get("/api/games").status_code == 401


def test_cookie_is_secure_over_https(client, monkeypatch):
    monkeypatch.setenv(al.ENV_SENHA, al.gerar_hash(SENHA))
    r = client.post("/api/acesso/entrar", json={"senha": SENHA}, headers={"X-Forwarded-Proto": "https"})
    assert "secure" in r.headers["set-cookie"].lower()


def test_too_many_wrong_passwords_are_blocked(client, monkeypatch):
    monkeypatch.setenv(al.ENV_SENHA, al.gerar_hash(SENHA))
    for _ in range(al.FALHAS_POR_IP):
        assert client.post("/api/acesso/entrar", json={"senha": "errada-errada"}).status_code == 401
    r = client.post("/api/acesso/entrar", json={"senha": SENHA})
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0


def test_env_file_update_keeps_other_lines(tmp_path):
    env = tmp_path / ".env"
    env.write_text("UPLOAD_POST_USER=canal\nOPENSHORTS_SENHA_HASH=velho\n", encoding="utf-8")
    al._gravar_env(str(env), "novo")
    assert env.read_text(encoding="utf-8") == "UPLOAD_POST_USER=canal\nOPENSHORTS_SENHA_HASH=novo\n"
    al._gravar_env(str(env), "")
    assert env.read_text(encoding="utf-8") == "UPLOAD_POST_USER=canal\n"


# ---- Gaming Edition input validation -----------------------------------------
@pytest.mark.parametrize("bad", ["..", "a.b", "abc%2F..", "a" * 65, "x y"])
def test_ids_with_path_characters_are_refused(client, bad):
    r = client.patch(f"/api/gaming/clips/{bad}/0", json={"approved": True})
    assert r.status_code in (400, 404)
    assert client.delete(f"/api/games/{bad}").status_code in (400, 404)


def test_clip_patch_rejects_unknown_and_oversized_fields(client):
    r = client.patch("/api/gaming/clips/abc/0", json={"description": "x" * 3000})
    assert r.status_code == 422
    r = client.patch("/api/gaming/clips/abc/0", json={"hashtags": ["#a"] * 31})
    assert r.status_code == 422


def test_publication_validation(client):
    base = {"job_id": "abc", "clip_index": 0, "platforms": ["youtube"]}
    assert client.post("/api/gaming/publications", json={**base, "job_id": "../x"}).status_code == 422
    assert client.post("/api/gaming/publications", json={**base, "clip_index": -1}).status_code == 422
    assert client.post("/api/gaming/publications", json={**base, "scheduled_at": "amanhã"}).status_code == 400
    assert client.post("/api/gaming/publications", json={**base, "title": "t" * 101}).status_code == 422
    ok = client.post("/api/gaming/publications", json={**base, "scheduled_at": "2026-12-01T10:00:00.000Z"})
    assert ok.status_code == 200 and ok.json()["status"] == "aguardando_aprovacao"


def test_game_preferences_only_keep_valid_values(out):
    g = library.create(out, {"name": "Valorant", "category": "fps_br", "preferences": {
        "layout": "<script>", "clip_seconds": 9999, "captions": "sim", "max_clips": 5, "admin": True}})
    p = g["preferences"]
    assert p["layout"] == "auto" and p["clip_seconds"] == 30 and p["captions"] is True
    assert p["max_clips"] == 5 and "admin" not in p
