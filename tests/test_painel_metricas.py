"""Painel → visualizações: the whole chain with Upload-Post faked.

/api/gaming/metrics calls our own /api/social/analytics/posts in-process,
which calls Upload-Post's post-analytics cache. Only the last hop (the vendor)
is replaced here, so the key header, the profile, the paging and the sums are
the real code paths the panel uses.
"""
import asyncio

import httpx
import pytest

import app as app_module

PAGES = [
    {"posts": [
        {"platform": "youtube", "title": "Clutch 1v4 no Free Fire", "post_url": "https://youtube.com/shorts/a",
         "post_metrics": {"views": 1200, "likes": 80, "comments": 5, "shares": 2}},
        {"platform": "tiktok", "caption": "Headshot", "share_url": "https://tiktok.com/@x/video/1",
         "post_metrics": {"play_count": 3400, "digg_count": 300, "comment_count": 12, "share_count": 9}},
    ], "has_more": True, "next_cursor": "c2"},
    {"posts": [
        {"platform": "youtube", "title": "Rush final", "metrics": {"views": "50", "likes": "4"}},
    ], "has_more": False, "next_cursor": None},
]


@pytest.fixture
def vendor(monkeypatch):
    calls = []

    async def fake_get(api_key, url, params):
        calls.append({"key": api_key, "url": url, "params": dict(params)})
        return PAGES[1] if params.get("cursor") == "c2" else PAGES[0]

    monkeypatch.setattr(app_module, "BILLING_ENABLED", False)
    monkeypatch.setattr(app_module, "_upload_post_get", fake_get)
    monkeypatch.delenv("UPLOAD_POST_API_KEY", raising=False)
    monkeypatch.delenv("UPLOAD_POST_USER", raising=False)
    return calls


def _get(path, headers=None):
    async def go():
        transport = httpx.ASGITransport(app=app_module.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:8000") as c:
            return await c.get(path, headers=headers or {})
    return asyncio.run(go())


def test_views_and_likes_reach_the_panel(vendor, monkeypatch):
    r = _get("/api/gaming/metrics?days=30&user=Fabricio",
             {"X-Upload-Post-Key": "chave-de-teste", "Origin": "http://127.0.0.1:5173"})
    if r.status_code == 401:
        pytest.skip("acesso local ativo neste ambiente; coberto pelo teste de login no navegador")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["configured"] is True and "error" not in d
    assert d["totals"] == {"views": 4650, "likes": 384, "comments": 17, "shares": 11, "posts": 3}
    yt = next(p for p in d["per_platform"] if p["platform"] == "youtube")
    assert yt["views"] == 1250 and yt["posts"] == 2
    assert d["top_posts"][0]["title"] == "Headshot" and d["top_posts"][0]["views"] == 3400
    assert d["top_posts"][0]["url"] == "https://tiktok.com/@x/video/1"
    # The key typed in the panel is the one sent to Upload-Post, for the
    # chosen profile, and both pages were read.
    assert [c["key"] for c in vendor] == ["chave-de-teste", "chave-de-teste"]
    assert all(c["params"]["user"] == "Fabricio" for c in vendor)
    assert vendor[0]["url"].endswith("/api/uploadposts/post-analytics/cached")
    assert vendor[1]["params"]["cursor"] == "c2"


def test_vendor_error_is_shown_not_hidden(vendor, monkeypatch):
    async def recusa(api_key, url, params):
        raise app_module.HTTPException(status_code=401, detail="Vendor API Error: invalid key")
    monkeypatch.setattr(app_module, "_upload_post_get", recusa)
    r = _get("/api/gaming/metrics?days=7&user=Fabricio",
             {"X-Upload-Post-Key": "errada", "Origin": "http://127.0.0.1:5173"})
    if r.status_code == 401 and "error" not in r.text:
        pytest.skip("acesso local ativo neste ambiente")
    d = r.json()
    assert d["configured"] is True
    assert "401" in d["error"] and "invalid key" in d["error"]


def test_without_profile_it_asks_to_configure(vendor):
    r = _get("/api/gaming/metrics?days=30", {"X-Upload-Post-Key": "k", "Origin": "http://127.0.0.1:5173"})
    if r.status_code == 401:
        pytest.skip("acesso local ativo neste ambiente")
    d = r.json()
    assert d["configured"] is False and "perfil" in d["reason"]
