"""Turn whatever YouTube link the person pasted into the one video it points at.

Links copied from a channel page usually carry extras that break a single
video download: ``&list=...`` (yt-dlp then tries the whole playlist or
channel uploads), ``?si=...`` share tokens, ``/shorts/`` or ``/live/`` paths,
``m.`` / ``music.`` hosts. A channel or playlist link with no video in it is
rejected with a message that says what to copy instead.

Non-YouTube links pass through untouched.
"""
import re
from urllib.parse import parse_qs, urlparse

_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_HOSTS = ("youtube.com", "youtube-nocookie.com", "youtu.be")
_PATH_ID = re.compile(r"^/(?:shorts|live|embed|v|e)/([A-Za-z0-9_-]{11})(?:[/?#]|$)")

CHANNEL_MSG = ("Esse link é de um canal do YouTube, não de um vídeo. Abra o vídeo que quer cortar "
               "e copie o link dele (Compartilhar → Copiar link).")
PLAYLIST_MSG = ("Esse link é de uma playlist, não de um vídeo. Abra o vídeo que quer cortar "
                "e copie o link dele (Compartilhar → Copiar link).")
NO_VIDEO_MSG = ("Não encontrei um vídeo nesse link do YouTube. Abra o vídeo e copie o link dele "
                "(Compartilhar → Copiar link).")


class LinkError(ValueError):
    """The link is a YouTube page with no single video in it."""


def is_youtube_host(host):
    host = (host or "").lower()
    return any(host == h or host.endswith("." + h) for h in _HOSTS)


def normalize_video_url(url):
    """Canonical https://www.youtube.com/watch?v=ID for any YouTube video link;
    other URLs are returned stripped but otherwise unchanged. Raises LinkError
    for YouTube channel/playlist/home links."""
    raw = (url or "").strip()
    if raw and "://" not in raw and re.match(r"^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)/", raw, re.I):
        raw = "https://" + raw
    try:
        p = urlparse(raw)
    except ValueError:
        return raw
    if not is_youtube_host(p.hostname):
        return raw

    host = (p.hostname or "").lower()
    path = p.path or "/"
    vid = None
    if host == "youtu.be" or host.endswith(".youtu.be"):
        cand = path.strip("/").split("/")[0]
        vid = cand if _ID.match(cand) else None
    else:
        q = parse_qs(p.query)
        cand = (q.get("v") or [""])[0]
        if _ID.match(cand):
            vid = cand
        else:
            m = _PATH_ID.match(path)
            vid = m.group(1) if m else None
        if vid is None:
            low = path.lower()
            if low.startswith(("/@", "/channel/", "/c/", "/user/")):
                raise LinkError(CHANNEL_MSG)
            if low.startswith("/playlist") or q.get("list"):
                raise LinkError(PLAYLIST_MSG)
    if vid is None:
        raise LinkError(NO_VIDEO_MSG)
    return f"https://www.youtube.com/watch?v={vid}"
