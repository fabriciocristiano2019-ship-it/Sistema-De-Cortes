"""YouTube cookies saved from the panel: validated, owner-only, never echoed."""
import os
import stat

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import youtube_cookies as yc

GOOD = ("# Netscape HTTP Cookie File\n"
        ".youtube.com\tTRUE\t/\tTRUE\t1893456000\tSID\tsegredo123\n"
        "#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t1893456000\tHSID\toutro\n")


@pytest.fixture(autouse=True)
def tmp_cookie_file(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENSHORTS_YT_COOKIES_FILE", str(tmp_path / "sub" / "c.txt"))
    monkeypatch.delenv("YOUTUBE_COOKIES", raising=False)


def test_save_validates_and_stores_owner_only():
    st = yc.save(GOOD)
    assert st == {**st, "configured": True, "source": "painel", "cookies": 2}
    mode = stat.S_IMODE(os.stat(yc.path()).st_mode)
    assert mode == 0o600
    assert yc.saved_file() == yc.path()


@pytest.mark.parametrize("bad", ["", "   ", "nada aqui", "# Netscape\n.example.com\tTRUE\t/\tTRUE\t0\ta\tb\n", None])
def test_rejects_text_without_youtube_cookies(bad):
    with pytest.raises(yc.CookieError):
        yc.save(bad)
    assert yc.saved_file() is None


def test_remove_and_secret_status(monkeypatch):
    yc.save(GOOD)
    assert yc.remove()["configured"] is False
    monkeypatch.setenv("YOUTUBE_COOKIES", "x")
    assert yc.status()["source"] == "secret"


def test_api_never_returns_the_cookie_content():
    import gaming_api
    app = FastAPI()
    app.include_router(gaming_api.router)
    c = TestClient(app)
    assert c.get("/api/gaming/youtube-cookies").json()["configured"] is False
    r = c.put("/api/gaming/youtube-cookies", json={"cookies": GOOD})
    assert r.status_code == 200 and "segredo123" not in r.text and r.json()["cookies"] == 2
    assert "segredo123" not in c.get("/api/gaming/youtube-cookies").text
    assert c.put("/api/gaming/youtube-cookies", json={"cookies": "lixo"}).status_code == 400
    assert c.delete("/api/gaming/youtube-cookies").json()["configured"] is False
