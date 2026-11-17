"""Chunked upload (/api/uploads/{id}/parte): Codespaces refuses big requests."""
import subprocess

import pytest
from fastapi.testclient import TestClient

import app as app_module


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(app_module, "UPLOAD_DIR", str(tmp_path))
    return TestClient(app_module.app)


@pytest.fixture(scope="module")
def video_bytes(tmp_path_factory):
    p = tmp_path_factory.mktemp("v") / "v.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=3",
                    "-pix_fmt", "yuv420p", str(p)], check=True)
    return p.read_bytes()


def _slot(client, name="Free Fire teste.mp4"):
    r = client.post("/api/uploads", json={"filename": name})
    assert r.status_code == 200
    return r.json()["upload_id"]


def test_parts_in_order_with_retry(client, video_bytes):
    uid = _slot(client)
    half = len(video_bytes) // 2
    a, b = video_bytes[:half], video_bytes[half:]
    assert client.put(f"/api/uploads/{uid}/parte?offset=0", content=a).json()["bytes"] == half
    again = client.put(f"/api/uploads/{uid}/parte?offset=0", content=a).json()          # retried part
    assert again["bytes"] == half and again["repetido"] is True
    assert client.put(f"/api/uploads/{uid}/parte?offset={half}", content=b).json()["bytes"] == len(video_bytes)
    r = client.post(f"/api/uploads/{uid}/concluir")
    assert r.status_code == 200 and r.json()["duration_seconds"] > 0
    slot = app_module.pending_uploads[uid]
    assert slot["complete"] and open(slot["path"], "rb").read() == video_bytes


def test_out_of_order_part_is_refused(client, video_bytes):
    uid = _slot(client)
    r = client.put(f"/api/uploads/{uid}/parte?offset=100", content=video_bytes[100:200])
    assert r.status_code == 409 and "fora de ordem" in r.json()["detail"]


def test_not_a_video_is_refused(client):
    uid = _slot(client)
    client.put(f"/api/uploads/{uid}/parte?offset=0", content=b"isto nao e um video" * 100)
    r = client.post(f"/api/uploads/{uid}/concluir")
    assert r.status_code == 400 and "não é um vídeo" in r.json()["detail"]
    assert uid not in app_module.pending_uploads


def test_unknown_slot(client):
    assert client.put("/api/uploads/nao-existe/parte?offset=0", content=b"x").status_code == 404
