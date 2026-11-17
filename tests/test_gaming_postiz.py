"""Postiz publisher (optional alternative to Upload-Post), against a fake API."""
import json

import httpx
import pytest

from gaming import postiz

ITEMS = [
    {"id": "yt1", "identifier": "youtube", "name": "Canal", "disabled": False},
    {"id": "ig1", "identifier": "instagram-standalone", "name": "@perfil", "disabled": False},
    {"id": "tt0", "identifier": "tiktok", "name": "velho", "disabled": True},
    {"id": "tt1", "identifier": "tiktok", "name": "@tiktok", "disabled": False},
]


def test_pick_integrations_and_missing_networks():
    got = postiz.pick_integrations(ITEMS, ["youtube", "instagram", "tiktok"])
    assert {k: v["id"] for k, v in got.items()} == {"youtube": "yt1", "instagram": "ig1", "tiktok": "tt1"}
    with pytest.raises(postiz.PostizError) as e:
        postiz.pick_integrations(ITEMS[:1], ["youtube", "tiktok", "instagram"])
    assert "TikTok" in str(e.value) and "Instagram" in str(e.value)


def test_post_body():
    targets = postiz.pick_integrations(ITEMS, ["youtube", "tiktok"])
    body = postiz.build_post({"id": "m1", "path": "https://cdn/x.mp4"}, targets, "Título", "Texto #ff", "2026-12-01T10:00:00Z")
    assert body["type"] == "schedule" and body["date"] == "2026-12-01T10:00:00Z"
    by = {p["integration"]["id"]: p for p in body["posts"]}
    assert by["yt1"]["settings"] == {"title": "Título", "type": "public"}
    assert by["tt1"]["settings"]["content_posting_method"] == "DIRECT_POST"        # never the inbox "UPLOAD"
    assert by["tt1"]["value"][0] == {"content": "Texto #ff", "image": [{"id": "m1", "path": "https://cdn/x.mp4"}]}


def test_publish_flow_against_fake_api(tmp_path, monkeypatch):
    monkeypatch.delenv("POSTIZ_API_URL", raising=False)
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"fake mp4")
    seen = []

    def handler(req):
        seen.append((req.method, req.url.path, req.headers.get("authorization")))
        if req.url.path == "/public/v1/integrations":
            return httpx.Response(200, json=ITEMS)
        if req.url.path == "/public/v1/upload":
            assert b"fake mp4" in req.content
            return httpx.Response(200, json={"id": "m9", "path": "https://cdn.postiz.com/m9.mp4"})
        if req.url.path == "/public/v1/posts":
            body = json.loads(req.content)
            assert body["posts"][0]["value"][0]["image"][0]["path"] == "https://cdn.postiz.com/m9.mp4"
            return httpx.Response(200, json=[{"postId": "p1"}])
        return httpx.Response(404)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    out = postiz.publish(str(clip), ["youtube"], "T", "D", api_key="chave", client=client)
    assert out["integrations"] == {"youtube": "yt1"}
    assert [s[1] for s in seen] == ["/public/v1/integrations", "/public/v1/upload", "/public/v1/posts"]
    assert all(s[2] == "chave" for s in seen)
    assert str(seen and "api.postiz.com")


def test_invalid_key_is_explained():
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(401, json={"message": "no"})))
    with pytest.raises(postiz.PostizError) as e:
        postiz.integrations("x", client=client)
    assert "chave do Postiz inválida" in str(e.value)


def test_not_configured(monkeypatch):
    monkeypatch.delenv("POSTIZ_API_KEY", raising=False)
    assert not postiz.configured() and postiz.configured("k")
    with pytest.raises(postiz.PostizError):
        postiz.integrations()


def test_approve_goes_through_postiz(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import gaming_api

    monkeypatch.setitem(gaming_api._STATE, "output_dir", str(tmp_path))
    monkeypatch.setitem(gaming_api._STATE, "jobs", {})
    job = tmp_path / "job1"
    job.mkdir()
    (job / "job1_v_clip_1.mp4").write_bytes(b"mp4")
    (job / "job1_v_metadata.json").write_text(json.dumps({"shorts": [
        {"start": 0, "end": 30, "video_url": "/videos/job1/job1_v_clip_1.mp4", "approved": True}]}), encoding="utf-8")
    calls = []
    monkeypatch.setattr(postiz, "publish", lambda path, plats, title, text, when, key, url: calls.append(
        (path, plats, title, text, key)) or {"integrations": {"youtube": "yt1"}})
    app = FastAPI()
    app.include_router(gaming_api.router)
    c = TestClient(app)
    pub = c.post("/api/gaming/publications", json={"job_id": "job1", "clip_index": 0, "platforms": ["youtube"],
                                                    "title": "Meu corte", "description": "Desc #ff"}).json()
    r = c.post(f"/api/gaming/publications/{pub['id']}/approve", headers={"X-Postiz-Key": "k"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "enviado" and r.json()["provider"] == "postiz"
    assert calls == [(str(job / "job1_v_clip_1.mp4"), ["youtube"], "Meu corte", "Desc #ff", "k")]
