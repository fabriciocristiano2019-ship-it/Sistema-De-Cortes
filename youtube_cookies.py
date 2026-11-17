"""YouTube cookies saved from the panel (Chaves e Integrações).

YouTube asks servers in the cloud (Codespaces included) to sign in before it
serves a video. The documented yt-dlp answer is the cookies of the person's
own account. Before this, the only way was a Codespaces secret plus a restart;
now the panel can save them too.

The file lives outside the repository (~/.openshorts/), owner-only (0600), and
its content is never sent back to the browser: the panel only learns whether
cookies exist, how many and when they were saved. The YOUTUBE_COOKIES
environment variable (secret) still wins when set.
"""
import os
import tempfile
import time

MAX_BYTES = 1024 * 1024
_DIR = os.path.join(os.path.expanduser("~"), ".openshorts")


def path():
    return os.environ.get("OPENSHORTS_YT_COOKIES_FILE") or os.path.join(_DIR, "youtube_cookies.txt")


class CookieError(ValueError):
    pass


def _youtube_lines(text):
    out = 0
    for line in text.splitlines():
        if line.startswith("#HttpOnly_"):
            line = line[len("#HttpOnly_"):]
        elif not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) == 7 and ("youtube.com" in parts[0] or "google.com" in parts[0]):
            out += 1
    return out


def save(text):
    """Validate a Netscape cookies.txt and store it (0600). Returns status()."""
    if not isinstance(text, str) or not text.strip():
        raise CookieError("Cole o conteúdo do arquivo cookies.txt.")
    text = text.replace("\r\n", "\n")
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise CookieError("Arquivo grande demais (máximo 1 MB). Exporte só os cookies de youtube.com.")
    if _youtube_lines(text) == 0:
        raise CookieError("Não achei cookies do YouTube no texto. Exporte os cookies de youtube.com "
                          "no formato Netscape (cookies.txt) e cole o arquivo inteiro.")
    target = path()
    os.makedirs(os.path.dirname(target), mode=0o700, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(target), prefix=".cookies-")
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text if text.endswith("\n") else text + "\n")
        os.replace(tmp, target)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return status()


def remove():
    try:
        os.remove(path())
    except FileNotFoundError:
        pass
    return status()


def status():
    p = path()
    env = bool(os.environ.get("YOUTUBE_COOKIES", "").strip())
    if not os.path.isfile(p):
        return {"configured": env, "source": "secret" if env else None, "cookies": 0, "saved_at": None}
    try:
        with open(p, encoding="utf-8", errors="replace") as f:
            n = _youtube_lines(f.read())
        saved = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(os.path.getmtime(p)))
    except OSError:
        n, saved = 0, None
    return {"configured": True, "source": "secret" if env else "painel", "cookies": n, "saved_at": saved}


def saved_file():
    """Path of the panel-saved cookies file, or None."""
    p = path()
    return p if os.path.isfile(p) else None
