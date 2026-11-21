"""Linha de produção + pasta de vídeos novos (owner, 21-nov-2026): the agents
shown as five stages, finished clips dropped in a folder with their text, and
no automatic posting anymore."""
import os
import pathlib
import zipfile
from datetime import datetime

import pytest

from gaming import entrega, pipeline

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = RAIZ / "dashboard" / "src" / "gaming"
CLIP = {"video_title_for_youtube_short": 'QUE SUSTO: "ele" não/esperava?! 😱', "description": "Olha isso",
        "hashtags": ["#gta6", "#shorts"] + [f"#t{i}" for i in range(40)]}


@pytest.fixture
def pasta(tmp_path, monkeypatch):
    monkeypatch.setenv("GAMING_PASTA_PRONTOS", str(tmp_path / "prontos"))
    return tmp_path / "prontos"


def _mp4(tmp_path, nome="c.mp4"):
    p = tmp_path / nome
    p.write_bytes(b"\x00\x00\x00\x18ftypmp42video")
    return str(p)


def test_clip_lands_in_todays_folder_with_its_text(pasta, tmp_path):
    final = entrega.entregar(_mp4(tmp_path), CLIP, 0, agora=datetime(2026, 11, 21, 10))
    assert final == str(pasta / "2026-11-21" / "01 - QUE SUSTO ele nãoesperava!.mp4")
    txt = open(final[:-4] + ".txt", encoding="utf-8").read()
    assert "TÍTULO" in txt and "Olha isso" in txt and "#gta6" in txt
    assert txt.count("#") == 30                              # Instagram's limit
    again = entrega.entregar(_mp4(tmp_path), CLIP, 0, agora=datetime(2026, 11, 21, 11))
    assert again.endswith("(2).mp4") and os.path.exists(final)  # never overwrites
    assert entrega.entregar(str(tmp_path / "nao-existe.mp4"), CLIP, 0) is None


def test_new_until_marked_seen_and_zip_of_the_new_ones(pasta, tmp_path):
    entrega.entregar(_mp4(tmp_path), CLIP, 0)
    entrega.entregar(_mp4(tmp_path), {"title": "Outro"}, 1)
    d = entrega.lista()
    assert d["total"] == 2 and d["novos"] == 2 and all(i["tem_texto"] for i in d["itens"])
    z = tmp_path / "n.zip"
    assert entrega.zip_novos(str(z)) == 2
    assert len(zipfile.ZipFile(z).namelist()) == 4           # 2 mp4 + 2 txt
    assert entrega.marcar_visto(agora=9e12)["novos"] == 0


def test_only_files_inside_the_folder_can_be_downloaded(pasta, tmp_path):
    final = entrega.entregar(_mp4(tmp_path), CLIP, 0)
    rel = os.path.relpath(final, pasta).replace(os.sep, "/")
    assert entrega.arquivo(rel) == os.path.realpath(final)
    for ruim in ("../segredo.mp4", "2026-11-21/../../x.mp4", "/etc/passwd", "2026-11-21/a.py", ""):
        assert entrega.arquivo(ruim) is None


def test_five_stages_light_up_from_the_agents():
    st = {a: "done" for a in ("ingest", "library", "whisper", "vision", "x51", "homer", "slicer")}
    st.update(aida="done", isaac="skipped", editor916="working", captions="waiting", social="waiting")
    got = {e["id"]: e["state"] for e in pipeline.linha(st)}
    assert got == {"tema": "done", "roteiro": "done", "voz": "skipped", "midia": "working", "edicao": "waiting"}
    assert [e["label"] for e in pipeline.LINHA] == ["Tema", "Roteiro", "Voz", "Mídia", "Edição"]
    assert sorted(a for e in pipeline.LINHA for a in e["agentes"]) == sorted(
        a["id"] for a in pipeline.TODOS if a["id"] not in ("herbie", "baymax"))
    st["aida"] = "skipped"                                   # no Gemini: local engine wrote the hook
    assert pipeline.linha(st)[1]["state"] == "done"
    snap = pipeline.snapshot([], "completed")
    assert [e["state"] for e in snap["linha"]][0] == "done"


def test_delivery_agent_and_its_log_lines():
    veronica = next(a for a in pipeline.AGENTS if a["id"] == "social")
    assert veronica["name"] == "Pasta de vídeos novos" and veronica["module"] == "pasta"
    agent, text, level = pipeline.classify("   📁 Na pasta de vídeos novos: 2026-11-21/01 - X.mp4")
    assert agent == "social" and level == "ok" and "01 - X.mp4" in text


def test_posting_is_gone_and_the_folder_routes_answer(pasta, tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import gaming_api
    app = FastAPI()
    app.include_router(gaming_api.router)
    c = TestClient(app)
    r = c.post("/api/gaming/publications/abc123/approve")
    assert r.status_code == 410 and "pasta de vídeos novos" in r.json()["detail"]
    for rota in ("/api/gaming/instagram", "/api/gaming/postiz/check"):
        assert c.get(rota).status_code in (404, 405)
    final = entrega.entregar(_mp4(tmp_path), CLIP, 0)
    rel = os.path.relpath(final, pasta).replace(os.sep, "/")
    assert c.get("/api/gaming/prontos").json()["novos"] == 1
    assert c.get("/api/gaming/prontos/arquivo", params={"caminho": rel}).status_code == 200
    assert c.get("/api/gaming/prontos/arquivo", params={"caminho": "../x.mp4"}).status_code == 404
    assert c.get("/api/gaming/prontos/novos.zip").headers["content-type"] == "application/zip"
    assert c.post("/api/gaming/prontos/visto").json()["novos"] == 0
    assert c.get("/api/gaming/prontos/novos.zip").status_code == 404


def test_main_delivers_gaming_clips_to_the_folder():
    s = (RAIZ / "main.py").read_text(encoding="utf-8")
    assert "entrega.entregar(captioned or deliver_path, clip, i)" in s and "gaming_job.json" in s
    assert "prontos/" in (RAIZ / ".gitignore").read_text(encoding="utf-8")


def test_panel_has_the_line_and_the_folder_and_no_posting():
    for nome in ("PublicarDialog.jsx", "InstagramIntegracao.jsx", "postizConf.js", "autoPublicar.js"):
        assert not (SRC / nome).exists()
    hub = (SRC / "GamingHub.jsx").read_text(encoding="utf-8")
    assert "id: 'pasta'" in hub and "<LinhaProducao" in hub and "<PastaSection" in hub
    assert "id: 'social'" not in hub and "id: 'schedule'" not in hub and "publicarAgora" not in hub
    linha = (SRC / "LinhaProducao.jsx").read_text(encoding="utf-8")
    for etapa in ("Tema", "Roteiro", "Voz", "Mídia", "Edição"):
        assert f"label: '{etapa}'" in linha
    assert "LINHA DE PRODUÇÃO · AUTO" in linha and "NOVOS" in linha
    cfg = (SRC / "Configuracoes.jsx").read_text(encoding="utf-8")
    assert "id: 'publicacao'" not in cfg and "id: 'instagram'" not in cfg


def test_old_tab_after_update_reloads_once_instead_of_dying():
    rec = (SRC / "recuperar.js").read_text(encoding="utf-8")
    assert "vite:preloadError" in rec and "dynamically imported module" in rec and "30000" in rec
    for k in ("uploadPostKey_v3", "gemini_key", "jarvis_termos_aceitos", "os_nome_painel", "uploadUserId"):
        assert f"'{k}'" not in rec                     # keys, login, name and terms are never cleared
    erro = (SRC / "ErroTela.jsx").read_text(encoding="utf-8")
    assert "recarregarUmaVez" in erro and "Limpar e recarregar" in erro
    assert "instalarRecuperacao()" in (SRC.parent / "main.jsx").read_text(encoding="utf-8")


def test_agent_studio_follows_the_ad():
    """"Segue o vídeo": each stage as its agent's card (radar, roteiro.txt with
    gancho / virada / clímax, voice bars, vertical frame, timeline, folder)."""
    palco = (SRC / "PalcoAgente.jsx").read_text(encoding="utf-8")
    for trecho in ("ROTEIRO.TXT", "CENA 1 · GANCHO FORTE", "CENA 2 · A VIRADA", "CENA 3 · CLÍMAX",
                   "TIMELINE · AUTO", "VÍDEOS NOVOS", "palco-radar", "AGENTE ·"):
        assert trecho in palco
    assert "auto_hook?.text" in palco and "peak_time" in palco        # real data, not a mock-up
    assert "Sem voz instalada" in palco                                  # says so when Voz is skipped
    assert "<PalcoAgente" in (SRC / "GamingHub.jsx").read_text(encoding="utf-8")
    css = (SRC / "sede.css").read_text(encoding="utf-8")
    assert ".palco-luzes" in css and "prefers-reduced-motion" in css
