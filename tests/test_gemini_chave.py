"""Gemini key saved from the panel: validated, owner-only, never echoed."""
import os
import stat

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import gemini_chave as gc

CHAVE = "AIzaSyTESTE_chave_de_mentira_1234567890"


@pytest.fixture(autouse=True)
def isolar(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENSHORTS_GEMINI_KEY_FILE", str(tmp_path / "k" / "gemini.key"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


def _client(resposta):
    return httpx.Client(transport=httpx.MockTransport(resposta))


def test_save_is_owner_only_and_sets_the_environment():
    st = gc.salvar(CHAVE)
    assert st == {"configured": True, "source": "painel", "final": "7890"}
    assert stat.S_IMODE(os.stat(gc.path()).st_mode) == 0o600
    assert os.environ["GEMINI_API_KEY"] == CHAVE


@pytest.mark.parametrize("ruim", ["", "  ", "curta", "com espaço no meio da chave 123", "AQ.Ab8 com espaço no meio 12345", None])
def test_rejects_what_is_not_a_key(ruim):
    with pytest.raises(gc.ChaveErro):
        gc.salvar(ruim)
    assert not os.path.exists(gc.path())


@pytest.mark.parametrize("formato", ["AIzaSyTESTE_chave_de_mentira_1234567890", "AQ.Ab8TESTEdeMentira-chave_nova.formato123"])
def test_accepts_old_and_new_google_key_formats(formato):
    assert gc.salvar(formato)["configured"] is True


def test_loaded_at_start_unless_env_already_has_one(monkeypatch):
    gc.salvar(CHAVE)
    monkeypatch.delenv("GEMINI_API_KEY")
    assert gc.carregar_no_ambiente() is True and os.environ["GEMINI_API_KEY"] == CHAVE
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaSecretDoCodespaces_000000000000")
    assert gc.carregar_no_ambiente() is False
    assert gc.status()["source"] == "secret"


def test_remove_only_clears_a_panel_key(monkeypatch):
    gc.salvar(CHAVE)
    assert gc.remover()["configured"] is False and "GEMINI_API_KEY" not in os.environ
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaSecretDoCodespaces_000000000000")
    assert gc.remover()["configured"] is True, "a secret is not the panel's to delete"


def test_test_call_uses_header_not_url_and_reads_models():
    vistos = {}

    def resp(req):
        vistos.update(url=str(req.url), key=req.headers.get("x-goog-api-key"))
        return httpx.Response(200, json={"models": [{"name": "models/gemini-3.7-flash"}, {"name": "models/x"}]})
    r = gc.testar(CHAVE, client=_client(resp))
    assert r["ok"] and "2 modelos" in r["mensagem"] and "gemini-3.7-flash" in r["mensagem"]
    assert vistos["key"] == CHAVE and CHAVE not in vistos["url"], "key in a header, never in the URL/logs"


@pytest.mark.parametrize("codigo,corpo,trecho", [
    (400, '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}', "Chave inválida"),
    (403, '{"error":{"status":"PERMISSION_DENIED"}}', "permissão"),
    (429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}', "cota"),
])
def test_google_errors_in_portuguese(codigo, corpo, trecho):
    r = gc.testar(CHAVE, client=_client(lambda req: httpx.Response(codigo, text=corpo)))
    assert r["ok"] is False and trecho in r["mensagem"] and not r.get("rede")


def test_network_failure_is_flagged():
    def falha(req):
        raise httpx.ConnectError("sem rede")
    r = gc.testar(CHAVE, client=_client(falha))
    assert r["ok"] is False and r["rede"] is True


def test_api_never_returns_the_key():
    import gaming_api
    app = FastAPI()
    app.include_router(gaming_api.router)
    c = TestClient(app)
    assert c.get("/api/gaming/gemini-chave").json()["configured"] is False
    r = c.put("/api/gaming/gemini-chave", json={"chave": CHAVE})
    assert r.status_code == 200 and CHAVE not in r.text and r.json()["final"] == "7890"
    assert CHAVE not in c.get("/api/gaming/gemini-chave").text
    assert c.put("/api/gaming/gemini-chave", json={"chave": "x"}).status_code == 400
    assert c.delete("/api/gaming/gemini-chave").json()["configured"] is False
