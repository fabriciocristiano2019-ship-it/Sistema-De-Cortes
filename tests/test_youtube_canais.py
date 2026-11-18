"""Buscar canais: only videos with a shown reason, credit on every clip.

The YouTube Data API is faked (no key or network here); the fake answers
with the same JSON shape the real endpoints document.
"""
import httpx
import pytest

import youtube_canais as yc


def _video(vid, titulo, canal, canal_id, desc="", lic="youtube", dur="PT25M3S", live="none",
           publicado="2026-11-10T20:00:00Z"):
    return {"id": vid, "snippet": {"title": titulo, "channelTitle": canal, "channelId": canal_id,
                                   "description": desc, "publishedAt": publicado, "liveBroadcastContent": live,
                                   "thumbnails": {"high": {"url": f"https://i.ytimg.com/vi/{vid}/hq.jpg"}}},
            "contentDetails": {"duration": dur}, "status": {"license": lic}}


VIDEOS = {
    "ccvideo0001": _video("ccvideo0001", "Free Fire CC", "Canal Livre", "UC" + "a" * 22, lic="creativeCommon"),
    "ccfalso0001": _video("ccfalso0001", "Filtro mentiu", "Outro", "UC" + "b" * 22, lic="youtube"),
    "libvideo001": _video("libvideo001", "Live de GTA RP", "Streamer BR", "UC" + "c" * 22,
                          desc="Live todo dia! Cortes liberados, só dar os créditos."),
    "proibido001": _video("proibido001", "Live proibida", "Bravo", "UC" + "d" * 22,
                          desc="Cortes liberados? NÃO. Proibido fazer cortes deste canal."),
    "canaldesc01": _video("canaldesc01", "Gameplay", "Canal Aberto", "UC" + "e" * 22, desc="sem nada"),
    "curtinho001": _video("curtinho001", "Short", "Canal Aberto", "UC" + "e" * 22, dur="PT45S",
                          desc="pode fazer cortes"),
    "lista000001": _video("lista000001", "Live do Alan", "alanzoka", "UC" + "f" * 22),
}
CANAIS = {
    "UC" + "c" * 22: "Gameplay toda noite.",
    "UC" + "d" * 22: "",
    "UC" + "e" * 22: "Canais de cortes são bem-vindos, podem postar à vontade.",
    "UC" + "f" * 22: "",
}


class FakeYT:
    def __init__(self):
        self.calls = []

    def get(self, url, params=None):
        recurso = url.rsplit("/", 1)[-1]
        self.calls.append((recurso, dict(params or {})))
        p = params or {}
        if recurso == "search":
            ids = (["ccvideo0001", "ccfalso0001"] if p.get("videoLicense") == "creativeCommon"
                   else ["libvideo001", "proibido001", "canaldesc01", "curtinho001"])
            return httpx.Response(200, json={"items": [{"id": {"videoId": i}} for i in ids]})
        if recurso == "videos":
            return httpx.Response(200, json={"items": [VIDEOS[i] for i in p["id"].split(",") if i in VIDEOS]})
        if recurso == "channels":
            if "forHandle" in p:
                return httpx.Response(200, json={"items": [{"id": "UC" + "f" * 22, "snippet": {"title": "alanzoka"}}]})
            return httpx.Response(200, json={"items": [{"id": c, "snippet": {"description": CANAIS.get(c, "")}}
                                                       for c in p["id"].split(",")]})
        if recurso == "playlistItems":
            assert p["playlistId"] == "UU" + "f" * 22
            return httpx.Response(200, json={"items": [{"contentDetails": {"videoId": "lista000001"}}]})
        return httpx.Response(404, text="?")


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENSHORTS_YOUTUBE_KEY_FILE", str(tmp_path / "yt.key"))
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    return tmp_path


def test_key_is_saved_private_and_never_returned(env):
    st = yc.salvar("AIza" + "x" * 35)
    assert st == {"configured": True, "final": "xxxx", "source": "painel"}
    assert oct((env / "yt.key").stat().st_mode)[-3:] == "600"
    with pytest.raises(yc.ChaveErro):
        yc.salvar("curta")


def test_search_without_key_says_what_is_missing(env):
    with pytest.raises(yc.BuscaErro, match="chave da API do YouTube"):
        yc.buscar(str(env), "free fire", "cc", client=FakeYT())


def test_creative_commons_is_checked_on_the_video_itself(env):
    yc.salvar("AIza" + "x" * 35)
    res = yc.buscar(str(env), "free fire", "cc", client=FakeYT())
    assert [r["video_id"] for r in res] == ["ccvideo0001"]       # the filter's false hit is dropped
    assert res[0]["nivel"] == "cc" and "Creative Commons" in res[0]["prova"]


def test_description_permission_with_proof_and_a_no_always_wins(env):
    yc.salvar("AIza" + "x" * 35)
    res = {r["video_id"]: r for r in yc.buscar(str(env), "gta rp", "liberados", client=FakeYT())}
    assert "libvideo001" in res and "cortes liberados" in res["libvideo001"]["prova"]
    assert "descrição do vídeo" in res["libvideo001"]["prova"]
    assert "canaldesc01" in res and "descrição do canal" in res["canaldesc01"]["prova"]
    assert "proibido001" not in res          # "proibido fazer cortes" beats "cortes liberados"
    assert "curtinho001" not in res          # under 2 minutes: already a Short


def test_channel_without_proof_is_pending_and_never_searched(env):
    yc.salvar("AIza" + "x" * 35)
    lista = yc.lista(str(env))
    assert lista[0]["nome"] == "@alanzoka" and lista[0]["situacao"] == "pendente"
    fake = FakeYT()
    assert yc.buscar(str(env), "", "lista", client=fake) == []
    assert not any(r == "playlistItems" for r, _ in fake.calls)


def test_channel_with_proof_lists_its_latest_videos(env):
    yc.salvar("AIza" + "x" * 35)
    fake = FakeYT()
    c = yc.adicionar(str(env), "https://www.youtube.com/@alanzoka", prova_url="https://x.com/alanzoka/status/1",
                     client=fake)
    assert c["canal_id"] == "UC" + "f" * 22 and c["situacao"] == "liberado"
    assert len(yc.lista(str(env))) == 1                       # replaced the pending seed, no duplicate
    res = yc.buscar(str(env), "", "lista", client=fake)
    assert res[0]["video_id"] == "lista000001" and res[0]["nivel"] == "lista"
    assert "x.com/alanzoka" in res[0]["prova"]


def test_bad_channel_or_proof_link_is_refused(env):
    with pytest.raises(yc.BuscaErro):
        yc.entrada_canal("alanzoka sem arroba")
    with pytest.raises(yc.BuscaErro):
        yc.adicionar(str(env), "@alguem", prova_url="javascript:alert(1)")


def test_quota_and_disabled_api_are_explained():
    assert "cota" in yc._explicar(403, '{"reason": "quotaExceeded"}')
    assert "não está ativada" in yc._explicar(403, "YouTube Data API v3 has not been used in project")


def test_credit_goes_on_every_description_once():
    cred = yc.limpar_credito({"canal": "Canal Livre", "url": "https://www.youtube.com/watch?v=ccvideo0001",
                              "nivel": "cc", "prova": "CC BY"})
    clips = [{"description": "Que jogada", "video_description_for_tiktok": "Que jogada #ff",
              "video_description_for_instagram": "Que jogada\n\n#ff"}]
    yc.aplicar_credito(clips, cred)
    yc.aplicar_credito(clips, cred)                           # twice: still one line
    for k in ("description", "video_description_for_tiktok", "video_description_for_instagram"):
        assert clips[0][k].count("Créditos: Canal Livre – https://www.youtube.com/watch?v=ccvideo0001") == 1
    assert "Creative Commons" in clips[0]["description"]
    assert yc.limpar_credito({"url": "https://evil.example/x"}) is None


def test_credit_travels_with_the_job_config():
    import gaming_api
    req = gaming_api.parse_gaming({"credito": {"canal": "X", "url": "https://youtu.be/abcdefghijk", "nivel": "lista"}})
    assert req["credito"]["canal"] == "X"
    assert gaming_api.parse_gaming({})["credito"] is None
