"""Backup .zip of the finished clips and the history (owner, 19-nov-2026).

A deleted codespace took every clip and the publication history with it.
The backup must carry what the library needs to show and post them again,
nothing heavy that can be re-made, and come back in a new codespace without
touching what is already there.
"""
import io
import json
import os
import zipfile

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import gaming_api
from gaming import backup
from test_guardar_cortes import BASE, JOB, _job


@pytest.fixture
def out(tmp_path, monkeypatch):
    monkeypatch.setitem(gaming_api._STATE, "output_dir", str(tmp_path))
    monkeypatch.setitem(gaming_api._STATE, "jobs", {})
    g = tmp_path / "gaming"
    g.mkdir()
    (g / "publications.json").write_text(json.dumps({"items": [
        {"id": "p1", "job_id": JOB, "clip_index": 0, "status": "enviado", "title": "Booyah"}]}), encoding="utf-8")
    (g / "canais.json").write_text(json.dumps([{"id": "alanzoka", "nome": "@alanzoka"}]), encoding="utf-8")
    (g / "covers").mkdir()
    (g / "covers" / "ff.jpg").write_bytes(b"jpg")
    return tmp_path


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(gaming_api.router)
    return TestClient(app)


def _zip(out):
    return zipfile.ZipFile(io.BytesIO(b"".join(backup.gerar_zip(str(out), gaming_api.tem_cortes, gaming_api._clip_url))))


def test_the_zip_has_the_delivered_clips_and_the_history_only(out):
    _job(out)
    nomes = set(_zip(out).namelist())
    assert f"jobs/{JOB}/subtitled_2001_hooked_1001_{BASE}_clip_1.mp4" in nomes
    assert f"jobs/{JOB}/subtitled_2002_hooked_1002_{BASE}_clip_2.mp4" in nomes
    assert f"jobs/{JOB}/{BASE}_metadata.json" in nomes and f"jobs/{JOB}/gaming_job.json" in nomes
    assert f"jobs/{JOB}/{BASE}.mp4" not in nomes                      # source video stays out
    assert not any(n.startswith(f"jobs/{JOB}/hooked_") for n in nomes)  # drafts stay out
    assert not any(".quadros" in n for n in nomes)
    assert {"backup.json", "gaming/publications.json", "gaming/canais.json", "gaming/covers/ff.jpg"} <= nomes


def test_summary_counts_what_goes_in(out):
    _job(out)
    r = backup.resumo(str(out), gaming_api.tem_cortes, gaming_api._clip_url)
    assert r["trabalhos"] == 1 and r["cortes"] == 2 and r["bytes"] > 10000


def test_restore_into_a_new_codespace_brings_everything_back(out, tmp_path_factory):
    _job(out)
    z = tmp_path_factory.mktemp("z") / "b.zip"
    z.write_bytes(b"".join(backup.gerar_zip(str(out), gaming_api.tem_cortes, gaming_api._clip_url)))
    novo = tmp_path_factory.mktemp("novo")
    res = backup.restaurar(str(novo), str(z))
    assert res["trabalhos"] == 1 and res["cortes"] == 2 and res["publicacoes"] == 1 and res["canais"] == 1
    assert (novo / JOB / f"subtitled_2001_hooked_1001_{BASE}_clip_1.mp4").read_bytes() == b"s" * 5000
    assert json.loads((novo / "gaming" / "publications.json").read_text())["items"][0]["id"] == "p1"
    # and the library plays it there
    meta = str(novo / JOB / f"{BASE}_metadata.json")
    assert gaming_api._clip_url(JOB, meta, 0, json.load(open(meta))["shorts"][0])


def test_restore_never_overwrites_and_merges_history(out, tmp_path_factory):
    _job(out)
    z = tmp_path_factory.mktemp("z") / "b.zip"
    z.write_bytes(b"".join(backup.gerar_zip(str(out), gaming_api.tem_cortes, gaming_api._clip_url)))
    final = out / JOB / f"subtitled_2001_hooked_1001_{BASE}_clip_1.mp4"
    final.write_bytes(b"editado depois")
    pubs = out / "gaming" / "publications.json"
    pubs.write_text(json.dumps({"items": [{"id": "p2", "status": "enviado"}]}), encoding="utf-8")
    res = backup.restaurar(str(out), str(z))
    assert res["trabalhos"] == 0 and res["trabalhos_ja_existiam"] == 1
    assert final.read_bytes() == b"editado depois"
    assert [p["id"] for p in json.loads(pubs.read_text())["items"]] == ["p2", "p1"]


def test_a_zip_with_strange_paths_writes_nothing_outside(out, tmp_path):
    z = tmp_path / "mau.zip"
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr("backup.json", "{}")
        zf.writestr("../fora.txt", "x")
        zf.writestr("jobs/../../fora2.txt", "x")
        zf.writestr("jobs/abc/../../fora3.txt", "x")
        zf.writestr("/etc/fora4", "x")
        zf.writestr("gaming/qualquer.json", "{}")
        zf.writestr("jobs/abc/sub/dir.mp4", "x")
    res = backup.restaurar(str(out), str(z))
    assert res["ignorados"] == 6
    assert not any((tmp_path / n).exists() for n in ("fora.txt", "fora2.txt", "fora3.txt"))
    assert not (out / "gaming" / "qualquer.json").exists()


def test_not_a_backup_is_refused(out, tmp_path):
    z = tmp_path / "x.zip"
    z.write_bytes(b"nao e zip")
    with pytest.raises(ValueError, match="não é um .zip"):
        backup.restaurar(str(out), str(z))
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr("foto.jpg", "x")
    with pytest.raises(ValueError, match="backup.json"):
        backup.restaurar(str(out), str(z))


def test_the_panel_routes_download_and_restore_in_parts(out, client, tmp_path_factory):
    _job(out)
    r = client.get("/api/gaming/backup")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    dados = r.content
    novo = tmp_path_factory.mktemp("novo")
    gaming_api._STATE["output_dir"] = str(novo)
    rid = client.post("/api/gaming/backup/restauracao").json()["id"]
    meio = len(dados) // 2
    assert client.put(f"/api/gaming/backup/restauracao/{rid}/parte?offset=0", content=dados[:meio]).status_code == 200
    assert client.put(f"/api/gaming/backup/restauracao/{rid}/parte?offset=0", content=dados[:meio]).json()["repetido"]
    assert client.put(f"/api/gaming/backup/restauracao/{rid}/parte?offset={meio + 100}", content=b"x").status_code == 409
    client.put(f"/api/gaming/backup/restauracao/{rid}/parte?offset={meio}", content=dados[meio:])
    res = client.post(f"/api/gaming/backup/restauracao/{rid}/concluir").json()
    assert res["cortes"] == 2
    assert not os.listdir(novo / "gaming" / ".restaurar")          # the uploaded zip is gone
    assert client.post(f"/api/gaming/backup/restauracao/{rid}/concluir").status_code == 404
    assert client.get("/api/gaming/backup/resumo").json()["cortes"] == 2


def test_a_full_download_marks_the_backup_and_new_clips_are_counted(out, client):
    _job(out)
    antes = client.get("/api/gaming/backup/resumo").json()
    assert antes["ultimo_backup"] is None and antes["cortes_sem_backup"] == 2
    assert client.get("/api/gaming/backup").status_code == 200
    depois = client.get("/api/gaming/backup/resumo").json()
    assert depois["ultimo_backup"] and depois["cortes_sem_backup"] == 0
    novo = out / JOB / f"subtitled_2002_hooked_1002_{BASE}_clip_2.mp4"
    t = depois["ultimo_backup"] + 60
    os.utime(novo, (t, t))                      # a clip re-rendered after the backup
    assert client.get("/api/gaming/backup/resumo").json()["cortes_sem_backup"] == 1


def test_a_download_cut_halfway_does_not_count_as_a_backup(out):
    _job(out)
    g = gaming_api._zip_e_marca()
    next(g)
    g.close()                                   # the browser went away
    assert backup.ultimo_backup(str(out)) is None


def test_heartbeat_gives_the_wake_up_link_in_codespaces(client, monkeypatch):
    monkeypatch.delenv("CODESPACE_NAME", raising=False)
    assert client.get("/api/gaming/vivo").json() == {"ok": True, "codespace": None}
    monkeypatch.setenv("CODESPACE_NAME", "studious-fiesta-abc123")
    monkeypatch.setenv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev")
    cs = client.get("/api/gaming/vivo").json()["codespace"]
    assert cs["religar_url"] == "https://studious-fiesta-abc123.github.dev"
    assert cs["painel_url"] == "https://studious-fiesta-abc123-5173.app.github.dev"
    monkeypatch.setenv("CODESPACE_NAME", "x.evil.com/")
    assert client.get("/api/gaming/vivo").json()["codespace"] is None
