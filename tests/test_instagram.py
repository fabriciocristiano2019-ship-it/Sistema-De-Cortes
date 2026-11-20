"""Instagram tab (owner, 20-nov-2026): see whether Instagram is connected and on
which Upload-Post profile; turn it on for "publicar ao aprovar". Read only."""
import pathlib

import httpx

from gaming import instagram

SRC = pathlib.Path(__file__).resolve().parent.parent / "dashboard" / "src" / "gaming"

USERS = {"success": True, "profiles": [
    {"username": "Fabricio", "social_accounts": {"youtube": {"display_name": "GamesShorts"},
                                                  "instagram": {"display_name": "gamesshorts2027"}, "tiktok": ""}},
    {"username": "vazio", "social_accounts": {"youtube": "", "instagram": "", "tiktok": ""}},
]}


def _cliente(status=200, body=USERS, chamadas=None):
    def h(req):
        if chamadas is not None:
            chamadas.append(req)
        return httpx.Response(status, json=body)
    return httpx.Client(transport=httpx.MockTransport(h))


def test_profiles_are_read_from_upload_post():
    p = instagram.perfis_upload_post(USERS)
    assert p[0] == {"perfil": "Fabricio", "instagram": True, "conta": "gamesshorts2027", "redes": ["youtube", "instagram"]}
    assert p[1]["instagram"] is False and p[1]["redes"] == []
    assert instagram.perfis_upload_post({"profiles": "lixo"}) == [] and instagram.perfis_upload_post(None) == []


def test_connected_on_the_profile_in_use(monkeypatch):
    monkeypatch.delenv("POSTIZ_API_KEY", raising=False)
    chamadas = []
    r = instagram.status("chave", perfil="Fabricio", client=_cliente(chamadas=chamadas))
    assert r["servico"] == "upload-post" and r["conectado"] is True and r["conta"] == "gamesshorts2027"
    assert chamadas[0].headers["authorization"] == "Apikey chave" and chamadas[0].method == "GET"


def test_wrong_or_missing_profile_suggests_the_one_with_instagram(monkeypatch):
    monkeypatch.delenv("POSTIZ_API_KEY", raising=False)
    monkeypatch.delenv("UPLOAD_POST_USER", raising=False)
    r = instagram.status("chave", perfil="vazio", client=_cliente())
    assert r["conectado"] is False and "não tem o Instagram" in r["erro"] and r["sugestao"] == "Fabricio"
    r = instagram.status("chave", perfil=None, client=_cliente())
    assert r["conectado"] is False and r["sugestao"] == "Fabricio"
    r = instagram.status("chave", perfil="outro", client=_cliente())
    assert "não existe" in r["erro"] and r["sugestao"] == "Fabricio"


def test_refused_key_and_no_key(monkeypatch):
    monkeypatch.delenv("POSTIZ_API_KEY", raising=False)
    monkeypatch.delenv("UPLOAD_POST_API_KEY", raising=False)
    assert instagram.status(None) == {"servico": None, "conectado": False}
    r = instagram.status("ruim", perfil="Fabricio", client=_cliente(status=401, body={}))
    assert r["conectado"] is False and "recusada" in r["erro"]


def test_postiz_wins_when_configured():
    itens = [{"identifier": "youtube", "name": "Canal"},
             {"identifier": "instagram-standalone", "name": "@gamesshorts2027", "disabled": False}]
    r = instagram.status(None, "pz", client=_cliente(body=itens))
    assert r == {"servico": "postiz", "conectado": True, "conta": "@gamesshorts2027", "erro": None}
    expirada = [{"identifier": "instagram", "name": "@x", "refreshNeeded": True}]
    r = instagram.status(None, "pz", client=_cliente(body=expirada))
    assert r["conectado"] is False and "reconectada" in r["erro"]


def test_endpoint_validates_profile_and_answers(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import gaming_api
    app = FastAPI()
    app.include_router(gaming_api.router)
    monkeypatch.setattr(instagram, "status", lambda *a, **k: {"servico": "upload-post", "conectado": True, "args": list(a)})
    c = TestClient(app)
    assert c.get("/api/gaming/instagram?perfil=<script>").status_code == 400
    r = c.get("/api/gaming/instagram?perfil=Fabricio", headers={"X-Upload-Post-Key": "k"})
    assert r.status_code == 200 and r.json()["args"][0] == "k" and r.json()["args"][-1] == "Fabricio"


def test_panel_offers_instagram_on_approve_and_has_its_own_tab():
    auto = (SRC / "autoPublicar.js").read_text(encoding="utf-8")
    assert "id: 'instagram'" in auto and "slice(0, 30)" in auto
    cfg = (SRC / "Configuracoes.jsx").read_text(encoding="utf-8")
    assert "id: 'instagram'" in cfg and "<InstagramIntegracao" in cfg
    tela = (SRC / "InstagramIntegracao.jsx").read_text(encoding="utf-8")
    assert "/api/gaming/instagram" in tela and "conta profissional" in tela


def test_old_tab_after_update_reloads_once_instead_of_dying():
    rec = (SRC / "recuperar.js").read_text(encoding="utf-8")
    assert "vite:preloadError" in rec and "dynamically imported module" in rec and "30000" in rec
    for k in ("uploadPostKey_v3", "gemini_key", "jarvis_termos_aceitos", "os_nome_painel", "uploadUserId"):
        assert f"'{k}'" not in rec                     # keys, login, name and terms are never cleared
    erro = (SRC / "ErroTela.jsx").read_text(encoding="utf-8")
    assert "recarregarUmaVez" in erro and "Limpar e recarregar" in erro
    main = (SRC.parent / "main.jsx").read_text(encoding="utf-8")
    assert "instalarRecuperacao()" in main
