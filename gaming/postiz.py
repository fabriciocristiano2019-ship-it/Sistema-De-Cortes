"""Publishing through Postiz (https://postiz.com), an alternative to Upload-Post.

Optional: used only when a Postiz API key is configured (POSTIZ_API_KEY in the
environment, or the X-Postiz-Key header sent by the panel's Settings). Works
with Postiz Cloud (default https://api.postiz.com) or a self-hosted Postiz
(POSTIZ_API_URL). Endpoints follow the official Postiz CLI (public API v1):

    GET  /public/v1/integrations          connected social accounts
    POST /public/v1/upload                multipart "file" -> {"path": ...}
    POST /public/v1/posts                 create / schedule a post

Postiz only publishes media it hosts, so the clip is uploaded first and its
returned path is what the post references. TikTok must use DIRECT_POST:
"UPLOAD" only drops the video in the TikTok inbox while the API reports
success.
"""
import os
from datetime import datetime, timezone

import httpx

DEFAULT_URL = "https://api.postiz.com"

# Our platform ids -> Postiz integration identifiers.
IDENTIFIERS = {
    "youtube": ("youtube",),
    "instagram": ("instagram", "instagram-standalone"),
    "tiktok": ("tiktok",),
}
LABEL = {"youtube": "YouTube", "instagram": "Instagram", "tiktok": "TikTok"}


class PostizError(Exception):
    pass


def configured(header_key=None):
    return bool((header_key or "").strip() or os.environ.get("POSTIZ_API_KEY", "").strip())


def _cfg(api_key=None, api_url=None):
    key = (api_key or "").strip() or os.environ.get("POSTIZ_API_KEY", "").strip()
    if not key:
        raise PostizError("Chave do Postiz não configurada.")
    url = ((api_url or "").strip() or os.environ.get("POSTIZ_API_URL", "").strip() or DEFAULT_URL).rstrip("/")
    return key, url


def _explain(resp):
    try:
        body = resp.json()
        msg = body.get("message") or body.get("error") or str(body)
    except ValueError:
        msg = resp.text[:200]
    if resp.status_code in (401, 403):
        return "chave do Postiz inválida ou sem permissão (confira o plano: a API pode não estar liberada no teste grátis)"
    if resp.status_code == 429:
        return "limite de envios do Postiz atingido; tente mais tarde"
    return f"Postiz respondeu {resp.status_code}: {str(msg)[:200]}"


def integrations(api_key=None, api_url=None, client=None):
    key, url = _cfg(api_key, api_url)
    c = client or httpx.Client(timeout=30)
    r = c.get(f"{url}/public/v1/integrations", headers={"Authorization": key})
    if r.status_code >= 300:
        raise PostizError(_explain(r))
    data = r.json()
    return data if isinstance(data, list) else data.get("integrations") or []


def pick_integrations(items, platforms):
    """{platform: integration} for each requested platform, or PostizError
    naming the networks that are not connected in Postiz."""
    out, missing = {}, []
    for plat in platforms:
        ids = IDENTIFIERS.get(plat, (plat,))
        cand = [i for i in items if str(i.get("identifier") or i.get("providerIdentifier") or "").lower() in ids
                and not i.get("disabled") and not i.get("refreshNeeded")]
        if cand:
            out[plat] = cand[0]
        else:
            missing.append(LABEL.get(plat, plat))
    if missing:
        raise PostizError("Conecte no Postiz a conta de: " + ", ".join(missing) + ".")
    return out


def settings_for(platform, title):
    if platform == "youtube":
        return {"title": (title or "Gameplay")[:100], "type": "public"}
    if platform == "tiktok":
        return {"privacy_level": "PUBLIC_TO_EVERYONE", "duet": False, "stitch": False,
                "content_posting_method": "DIRECT_POST"}
    if platform == "instagram":
        return {"post_type": "post"}
    return {}


def upload(video_path, api_key=None, api_url=None, client=None):
    key, url = _cfg(api_key, api_url)
    c = client or httpx.Client(timeout=600)
    with open(video_path, "rb") as f:
        r = c.post(f"{url}/public/v1/upload", headers={"Authorization": key},
                   files={"file": (os.path.basename(video_path), f, "video/mp4")})
    if r.status_code >= 300:
        raise PostizError(_explain(r))
    data = r.json()
    if not data.get("path"):
        raise PostizError("O Postiz não devolveu o endereço do vídeo enviado.")
    return data


def build_post(media, targets, title, text, scheduled_at=None):
    """Body for POST /public/v1/posts (pure: unit-tested)."""
    when = scheduled_at or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    image = [{"id": str(media.get("id") or "clip"), "path": media["path"]}]
    return {
        "type": "schedule", "date": when, "shortLink": False, "tags": [],
        "posts": [{
            "integration": {"id": integ["id"]},
            "value": [{"content": text or title or "", "image": image}],
            "settings": settings_for(plat, title),
        } for plat, integ in targets.items()],
    }


def publish(video_path, platforms, title, text, scheduled_at=None, api_key=None, api_url=None, client=None):
    """Upload the clip and create the post on every requested network.
    Returns {"posts": <Postiz answer>, "integrations": {platform: id}}."""
    c = client or httpx.Client(timeout=600)
    targets = pick_integrations(integrations(api_key, api_url, c), platforms)
    media = upload(video_path, api_key, api_url, c)
    key, url = _cfg(api_key, api_url)
    r = c.post(f"{url}/public/v1/posts", headers={"Authorization": key, "Content-Type": "application/json"},
               json=build_post(media, targets, title, text, scheduled_at))
    if r.status_code >= 300:
        raise PostizError(_explain(r))
    return {"posts": r.json(), "integrations": {p: i["id"] for p, i in targets.items()}}
