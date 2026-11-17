"""Gaming Edition REST API (mounted by app.py).

Routes (all JSON unless noted):
  GET    /api/gaming/meta                       categories, moments, layouts, durations
  GET    /api/games                             library + per-game stats (computed from disk)
  POST   /api/games                             create a custom game
  PUT    /api/games/{id}                        edit name/category/aliases/preferences
  DELETE /api/games/{id}                        remove (produced clips stay)
  POST   /api/games/{id}/cover                  multipart image -> cover (validated, re-encoded)
  POST   /api/gaming/identify                   guess the game from a file name
  GET    /api/gaming/dashboard                  totals, per game/category/moment, recent jobs
  GET    /api/gaming/clips                      every clip of every gaming job (video library)
  PATCH  /api/gaming/clips/{job_id}/{index}     edit title/description/hashtags, approve/reject
  POST   /api/gaming/clips/{job_id}/{index}/thumbnail   local thumbnail: best frame + title (free)
  GET    /api/gaming/publications               publication queue + history
  POST   /api/gaming/publications               queue a clip (needs manual approval first)
  POST   /api/gaming/publications/{id}/approve  approve -> sends to Upload-Post (now or scheduled)
  DELETE /api/gaming/publications/{id}          cancel a queued publication
  GET    /api/gaming/pipeline/{job_id}          per-agent state of a job (Sede Virtual)
  GET    /api/gaming/queue                      jobs running / waiting right now
  POST   /api/gaming/selftest                   real toolchain check ("Executar Teste Completo")
  GET    /api/gaming/system                     versions, limits, disk
  GET    /api/gaming/metrics                    views / likes from published posts

Publishing goes through the existing /api/social/post (Upload-Post) in
process, so there is one publishing path. Nothing is ever published without
an explicit approval call.
"""
import asyncio
import glob
from datetime import datetime
import io
import json
import os
import re
import threading
import time
import uuid
from typing import Annotated, List, Optional

import httpx
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from gaming import library, pipeline, postiz, profiles
from gaming.pipeline import TimedLogs  # noqa: F401  (re-exported for app.py)
from gaming.moments import fmt_ts

router = APIRouter()
_STATE = {"output_dir": None, "jobs": None, "app": None}
_PUB_LOCK = threading.Lock()

LAYOUTS = {
    "auto": {"label": "Automático", "strategy": None},
    "full": {"label": "A · Gameplay em tela inteira", "strategy": "WIDE"},   # full width: HUD, map and scoreboard kept
    "webcam": {"label": "B · Gameplay com webcam", "strategy": "INSET"},
    "vertical": {"label": "C · Gameplay adaptada para vertical", "strategy": "TRACK"},
}
DURATIONS = [15, 30, 45, 60]
ENGINES = {"local": "Local (gratuito)", "auto": "Automático (Gemini se houver chave)",
           "gemini": "Gemini (exige chave; pode ter custo)"}


def init(app, output_dir, jobs):
    _STATE.update(app=app, output_dir=output_dir, jobs=jobs)
    app.include_router(router)


def _out():
    return _STATE["output_dir"]


# --------------------------------------------------------------------------- #
# /api/process helpers (imported by app.py)
# --------------------------------------------------------------------------- #
def parse_gaming(raw):
    """Validate the `gaming` field of /api/process. Returns a normalised dict or None."""
    if raw in (None, "", "null"):
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raise HTTPException(status_code=400, detail="Campo 'gaming' não é um JSON válido")
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="Campo 'gaming' deve ser um objeto")
    engine = str(raw.get("engine") or "auto").lower()
    if engine not in ENGINES:
        raise HTTPException(status_code=400, detail=f"engine inválido: {engine}")
    layout = str(raw.get("layout") or "auto").lower()
    if layout not in LAYOUTS:
        raise HTTPException(status_code=400, detail=f"layout inválido: {layout}")
    try:
        # Only a missing value takes the default: an explicit 0 is a mistake to
        # report, not something to replace quietly.
        clip_seconds = float(raw["clip_seconds"] if raw.get("clip_seconds") is not None else 30)
        max_clips = int(raw["max_clips"] if raw.get("max_clips") is not None else 8)
        min_score = float(raw.get("min_score") if raw.get("min_score") is not None else 30)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="clip_seconds/max_clips/min_score inválidos")
    if not 5 <= clip_seconds <= 180:
        raise HTTPException(status_code=400, detail="Duração do corte deve ficar entre 5 e 180 s")
    if not 1 <= max_clips <= 30:
        raise HTTPException(status_code=400, detail="Quantidade de cortes deve ficar entre 1 e 30")
    if not 0 <= min_score <= 100:
        raise HTTPException(status_code=400, detail="Pontuação mínima deve ficar entre 0 e 100")
    moments = [m for m in (raw.get("moments") or []) if m in profiles.MOMENTS]

    game_id = raw.get("game_id") or "auto"
    game = {"id": "auto"}
    if game_id != "auto":
        g = library.get(_out(), game_id)
        if not g:
            raise HTTPException(status_code=404, detail="Jogo não encontrado na biblioteca")
        game = {"id": g["id"], "name": g["name"], "category": g["category"]}
    fallback_category = raw.get("category") if raw.get("category") in profiles.CATEGORIES else "other"
    inset_box = raw.get("inset_box")
    if inset_box is not None:
        try:
            vals = [float(v) for v in inset_box]
            assert len(vals) == 4 and all(0 <= v <= 1 for v in vals)
            inset_box = ",".join(f"{v:.4f}" for v in vals)
        except Exception:
            raise HTTPException(status_code=400, detail="inset_box deve ser [x, y, largura, altura] em frações 0-1")
    return {
        "engine": engine, "layout": layout, "game": game,
        "fallback_category": fallback_category,
        "fallback_name": str(raw.get("game_name") or "Gameplay")[:80],
        "settings": {"clip_seconds": clip_seconds, "max_clips": max_clips,
                     "min_score": min_score, "moments": moments},
        "zoom": bool(raw.get("zoom", True)),
        "inset_box": inset_box,
    }


async def gaming_from_request(request: Request, form_value):
    raw = form_value
    if raw is None and request.headers.get("content-type", "").startswith("application/json"):
        try:
            raw = (await request.json()).get("gaming")
        except Exception:
            raw = None
    return parse_gaming(raw)


def write_job_config(job_dir, req, source_name):
    cfg = {
        "engine": req["engine"], "game": req["game"], "settings": req["settings"],
        "library_dir": _out(), "source_name": os.path.basename(str(source_name or "")),
        "fallback_category": req["fallback_category"], "fallback_name": req["fallback_name"],
        "layout": req["layout"],
    }
    path = os.path.join(job_dir, "gaming_job.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return path


def job_env(req):
    env = {}
    strategy = LAYOUTS[req["layout"]]["strategy"]
    if strategy:
        env["FORCE_STRATEGY"] = strategy
        env["AUTO_LAYOUT"] = "0"   # an explicit layout replaces the Gemini picker
    else:
        # The generic picker is tuned for talking heads; gameplay "auto" is
        # decided in main.gaming_auto_layout (webcam -> B, else A), for free.
        env["AUTO_LAYOUT"] = "0"
    if req.get("inset_box"):
        env["INSET_BOX"] = req["inset_box"]
    if req.get("zoom"):
        env["PUNCH_IN"] = "1"
    # Whisper language: gameplay commentary here is mostly PT-BR; auto-detect
    # still runs when the env leaves it unset.
    return env


# --------------------------------------------------------------------------- #
# Library
# --------------------------------------------------------------------------- #
_ID_RE = re.compile(r"[A-Za-z0-9_-]{1,64}")


def _check_id(value, what="job_id"):
    """Ids reach the filesystem (job folders): letters, digits, - and _ only."""
    if not isinstance(value, str) or not _ID_RE.fullmatch(value):
        raise HTTPException(status_code=400, detail=f"{what} inválido")
    return value


Texto = lambda n: Field(default=None, max_length=n)


class GameIn(BaseModel):
    name: Optional[str] = Texto(80)
    category: Optional[str] = Texto(40)
    aliases: Optional[List[str]] = Field(default=None, max_length=20)
    preferences: Optional[dict] = None


def _with_stats(games):
    st = library.stats(_out())
    out = []
    for g in games:
        s = st.get(g["id"], {"videos": 0, "clips": 0, "history": []})
        cover = None
        if g.get("cover"):
            cover = f"/videos/gaming/covers/{g['cover']}?v={int(g.get('cover_updated', 0))}"
        out.append({**g, "cover_url": cover,
                    "category_label": profiles.category(g["category"])["label"],
                    "videos": s["videos"], "clips": s["clips"], "history": s["history"][:20]})
    return out


@router.get("/api/gaming/meta")
async def gaming_meta():
    return {
        "categories": profiles.category_list(),
        "moments": profiles.moment_list(),
        "layouts": [{"id": k, "label": v["label"]} for k, v in LAYOUTS.items()],
        "durations": DURATIONS,
        "engines": [{"id": k, "label": v} for k, v in ENGINES.items()],
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY")),
        "upload_post_configured": bool(os.environ.get("UPLOAD_POST_API_KEY")),
        "postiz_configured": postiz.configured(),
        "defaults": library.DEFAULT_PREFS,
        "agents": pipeline.AGENTS,
    }


@router.get("/api/games")
async def list_games():
    return {"games": _with_stats(library.load(_out()))}


@router.post("/api/games")
async def create_game(body: GameIn):
    try:
        g = library.create(_out(), body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _with_stats([g])[0]


@router.put("/api/games/{game_id}")
async def update_game(game_id: str, body: GameIn):
    _check_id(game_id, "game_id")
    data = body.model_dump(exclude_none=True)
    if "name" in data and not data["name"].strip():
        raise HTTPException(status_code=400, detail="nome do jogo é obrigatório")
    g = library.update(_out(), game_id, data)
    if not g:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    return _with_stats([g])[0]


@router.delete("/api/games/{game_id}")
async def delete_game(game_id: str):
    _check_id(game_id, "game_id")
    if not library.delete(_out(), game_id):
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    return {"ok": True}


MAX_COVER_BYTES = 8 * 1024 * 1024


@router.post("/api/games/{game_id}/cover")
async def upload_cover(game_id: str, file: UploadFile = File(...)):
    _check_id(game_id, "game_id")
    if not library.get(_out(), game_id):
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    data = await file.read(MAX_COVER_BYTES + 1)
    if len(data) > MAX_COVER_BYTES:
        raise HTTPException(status_code=413, detail="Imagem acima de 8 MB")
    # Decode and re-encode: the stored file is always a clean JPEG produced by
    # Pillow, never the uploaded bytes (no polyglots, no SVG scripts).
    from PIL import Image, UnidentifiedImageError
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Arquivo não é uma imagem válida")
    img = img.convert("RGB")
    img.thumbnail((600, 800))
    name = f"{game_id}.jpg"
    dst = os.path.join(_out(), "gaming", "covers", name)
    tmp = dst + ".tmp"
    img.save(tmp, "JPEG", quality=88)
    os.replace(tmp, dst)
    g = library.update(_out(), game_id, {"cover": name, "cover_updated": time.time()})
    return _with_stats([g])[0]


class IdentifyIn(BaseModel):
    filename: str = ""


@router.post("/api/gaming/identify")
async def identify(body: IdentifyIn):
    return library.identify(_out(), body.filename, None)


# --------------------------------------------------------------------------- #
# Clips: library, dashboard, edit/approve
# --------------------------------------------------------------------------- #
def _gaming_jobs():
    """Yield (job_id, metadata_path, data) for every finished gaming job on disk."""
    for meta in glob.glob(os.path.join(_out(), "*", "*_metadata.json")):
        try:
            with open(meta, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            continue
        if data.get("gaming"):
            yield os.path.basename(os.path.dirname(meta)), meta, data


def _clip_url(job_id, meta_path, index, clip=None):
    base = os.path.basename(meta_path).replace("_metadata.json", "")
    job_dir = os.path.dirname(meta_path)
    # An edit (recut, captions, hook) records the file it produced in the metadata.
    url = (clip or {}).get("video_url") or ""
    if url.startswith(f"/videos/{job_id}/") and os.path.exists(os.path.join(job_dir, url.rsplit("/", 1)[-1])):
        return url
    # Prefer the delivered (captioned/hooked) file the pipeline announced.
    jobs = _STATE["jobs"] or {}
    j = jobs.get(job_id) or {}
    clips = ((j.get("result") or {}).get("clips") or [])
    if index < len(clips) and clips[index].get("video_url"):
        # Only when the file is really there: a cancelled job lists clips that
        # were never rendered, and a guessed name would be a dead link.
        from urllib.parse import unquote
        name = unquote(str(clips[index]["video_url"]).rsplit("/", 1)[-1])
        if os.path.exists(os.path.join(job_dir, name)):
            return clips[index]["video_url"]
    cands = sorted(glob.glob(os.path.join(job_dir, f"*{base}_clip_{index + 1}.mp4")),
                   key=lambda p: (-os.path.getmtime(p)))
    cands = [c for c in cands if not os.path.basename(c).startswith("temp_")]
    if cands:
        return f"/videos/{job_id}/{os.path.basename(cands[0])}"
    return None


def _job_layout(job_dir):
    """Layout the job was submitted with (gaming_job.json), or None."""
    try:
        with open(os.path.join(job_dir, "gaming_job.json"), "r", encoding="utf-8") as f:
            return json.load(f).get("layout")
    except (OSError, ValueError):
        return None


@router.get("/api/gaming/clips")
async def all_clips(game_id: Optional[str] = None, status: Optional[str] = None):
    out = []
    for job_id, meta, data in _gaming_jobs():
        g = data["gaming"]
        if game_id and g.get("game_id") != game_id:
            continue
        layout = _job_layout(os.path.dirname(meta))
        source = library.display_source(job_id, data.get("source_video"))
        for i, c in enumerate(data.get("shorts") or []):
            st = {True: "aprovado", False: "rejeitado"}.get(c.get("approved"), "pendente")
            if status and st != status:
                continue
            out.append({**{k: v for k, v in c.items() if k != "words"},
                        # Recomputed on read: the editor's recut moves start/end.
                        "start_timecode": fmt_ts(c.get("start", 0)), "end_timecode": fmt_ts(c.get("end", 0)),
                        "job_id": job_id, "clip_index": i, "status": st,
                        "layout": layout, "source": source,
                        "video_url": _clip_url(job_id, meta, i, c),
                        "created_at": os.path.getmtime(meta)})
    out.sort(key=lambda c: (-c["created_at"], c["clip_index"]))
    return {"clips": out}


@router.get("/api/gaming/dashboard")
async def dashboard():
    games = {g["id"]: g for g in library.load(_out())}
    totals = {"games": len(games), "videos": 0, "clips": 0, "approved": 0, "pending": 0,
              "rejected": 0, "seconds": 0.0, "external_api_jobs": 0}
    by_game, by_cat, by_moment, by_day, recent = {}, {}, {}, {}, []
    for job_id, meta, data in _gaming_jobs():
        g = data["gaming"]
        shorts = data.get("shorts") or []
        totals["videos"] += 1
        totals["clips"] += len(shorts)
        name = g.get("game_name") or "Sem jogo"
        by_game[name] = by_game.get(name, 0) + len(shorts)
        cat = profiles.category(g.get("category") or "other")["label"]
        by_cat[cat] = by_cat.get(cat, 0) + len(shorts)
        day = time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(meta)))
        by_day[day] = by_day.get(day, 0) + len(shorts)
        for c in shorts:
            m = c.get("moment_label") or "Outro"
            by_moment[m] = by_moment.get(m, 0) + 1
            totals["seconds"] += max(0.0, float(c.get("end", 0)) - float(c.get("start", 0)))
            if c.get("approved") is True:
                totals["approved"] += 1
            elif c.get("approved") is False:
                totals["rejected"] += 1
            else:
                totals["pending"] += 1
        if g.get("engine") == "gemini":
            totals["external_api_jobs"] += 1
        recent.append({"job_id": job_id, "game": name, "clips": len(shorts),
                       "engine": g.get("engine"), "created_at": os.path.getmtime(meta),
                       "source": library.display_source(job_id, data.get("source_video"))})
    recent.sort(key=lambda r: -r["created_at"])
    pubs = _load_pubs()
    totals["scheduled"] = sum(1 for p in pubs if p["status"] in ("aguardando_aprovacao", "agendado"))
    totals["published"] = sum(1 for p in pubs if p["status"] == "enviado")

    def top(d):
        return [{"label": k, "value": v} for k, v in sorted(d.items(), key=lambda kv: -kv[1])]
    jobs = _STATE["jobs"] or {}
    running = [{"job_id": k, "status": v.get("status")} for k, v in jobs.items()
               if v.get("status") in ("queued", "processing")]
    return {"totals": totals, "by_game": top(by_game), "by_category": top(by_cat),
            "by_moment": top(by_moment),
            "by_day": [{"label": k, "value": by_day[k]} for k in sorted(by_day)][-30:],
            "recent": recent[:10], "running": running}


class ClipPatch(BaseModel):
    approved: Optional[bool] = None
    video_title_for_youtube_short: Optional[str] = Texto(300)
    video_description_for_tiktok: Optional[str] = Texto(2200)
    video_description_for_instagram: Optional[str] = Texto(2200)
    description: Optional[str] = Texto(2200)
    hashtags: Optional[List[Annotated[str, Field(max_length=60)]]] = Field(default=None, max_length=30)
    moment_category: Optional[str] = Texto(40)


@router.patch("/api/gaming/clips/{job_id}/{index}")
async def patch_clip(job_id: str, index: int, body: ClipPatch):
    _check_id(job_id)
    metas = glob.glob(os.path.join(_out(), job_id, "*_metadata.json"))
    if not metas:
        raise HTTPException(status_code=404, detail="Trabalho não encontrado")
    meta = metas[0]
    with open(meta, "r", encoding="utf-8") as f:
        data = json.load(f)
    shorts = data.get("shorts") or []
    if not 0 <= index < len(shorts):
        raise HTTPException(status_code=404, detail="Corte não encontrado")
    patch = body.model_dump(exclude_unset=True)
    if "moment_category" in patch:
        if patch["moment_category"] not in profiles.MOMENTS:
            raise HTTPException(status_code=400, detail="Categoria de momento inválida")
        patch["moment_label"] = profiles.MOMENTS[patch["moment_category"]]["label"]
    for k in ("video_title_for_youtube_short", "description"):
        if k in patch and patch[k] is not None:
            patch[k] = patch[k][:300]
    shorts[index].update(patch)
    tmp = meta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, meta)
    # Keep the in-memory job result (what /api/status serves) in step.
    j = (_STATE["jobs"] or {}).get(job_id)
    if j and (j.get("result") or {}).get("clips") and index < len(j["result"]["clips"]):
        j["result"]["clips"][index].update(patch)
    return {**shorts[index], "job_id": job_id, "clip_index": index}


class ThumbIn(BaseModel):
    text: Optional[str] = Texto(90)


def _clean_clip_file(job_dir, base, index, fallback_url):
    """The clip without burned captions or hook (they would sit under the
    thumbnail text); else whatever file the clip currently serves."""
    name = f"{base}_clip_{index + 1}.mp4"
    plain = os.path.join(job_dir, name)
    if os.path.exists(plain):
        return plain
    if fallback_url:
        from urllib.parse import unquote
        cand = os.path.join(job_dir, unquote(fallback_url.rsplit("/", 1)[-1]))
        if os.path.exists(cand):
            return cand
    return None


@router.post("/api/gaming/clips/{job_id}/{index}/thumbnail")
def make_thumbnail(job_id: str, index: int, body: ThumbIn):
    """Local thumbnail (best frame + title). Free: no model, no API."""
    from gaming import thumbs
    _check_id(job_id)
    metas = glob.glob(os.path.join(_out(), job_id, "*_metadata.json"))
    if not metas:
        raise HTTPException(status_code=404, detail="Trabalho não encontrado")
    meta = metas[0]
    job_dir = os.path.dirname(meta)
    with open(meta, "r", encoding="utf-8") as f:
        data = json.load(f)
    shorts = data.get("shorts") or []
    if not 0 <= index < len(shorts):
        raise HTTPException(status_code=404, detail="Corte não encontrado")
    clip = shorts[index]
    base = os.path.basename(meta).replace("_metadata.json", "")
    src = _clean_clip_file(job_dir, base, index, _clip_url(job_id, meta, index, clip))
    if not src:
        raise HTTPException(status_code=409, detail="O vídeo deste corte ainda não foi renderizado.")
    text = (body.text or "").strip() or clip.get("viral_hook_text") or clip.get("video_title_for_youtube_short") or "Gameplay"
    at = float(clip.get("peak_time") or clip.get("start") or 0) - float(clip.get("start") or 0)
    name = f"thumb_{int(time.time())}_clip_{index + 1}.jpg"
    try:
        info = thumbs.make(src, os.path.join(job_dir, name), text, at, tag=clip.get("game_name"))
    except Exception as e:
        # Details (paths, library errors) go to the server log, not to the browser.
        print(f"[gaming] thumbnail falhou ({job_id}/{index}): {e!r}")
        raise HTTPException(status_code=500, detail="Não foi possível gerar a thumbnail. Veja o registro do servidor.")
    old = clip.get("thumbnail_url") or ""
    if old.startswith(f"/videos/{job_id}/thumb_"):
        try:
            os.remove(os.path.join(job_dir, old.rsplit("/", 1)[-1]))
        except OSError:
            pass
    clip["thumbnail_url"] = f"/videos/{job_id}/{name}"
    clip["thumbnail_text"] = text[:90]
    tmp = meta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, meta)
    return {"thumbnail_url": clip["thumbnail_url"], "text": clip["thumbnail_text"], **info}


# --------------------------------------------------------------------------- #
# Publication centre (approval queue -> Upload-Post)
# --------------------------------------------------------------------------- #
def _pubs_path():
    d = os.path.join(_out(), "gaming")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "publications.json")


def _load_pubs():
    try:
        with open(_pubs_path(), "r", encoding="utf-8") as f:
            return json.load(f).get("items", [])
    except (OSError, ValueError):
        return []


def _save_pubs(items):
    tmp = _pubs_path() + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"items": items}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, _pubs_path())


class PubIn(BaseModel):
    job_id: str = Field(..., pattern=r"^[A-Za-z0-9_-]{1,64}$")
    clip_index: int = Field(..., ge=0, le=999)
    platforms: List[str] = Field(..., max_length=3)
    title: Optional[str] = Texto(100)
    description: Optional[str] = Texto(2200)
    user_id: Optional[str] = Field(default=None, max_length=80)   # Upload-Post profile name (self-host BYOK)
    scheduled_at: Optional[str] = Texto(40)   # ISO-8601; empty = publish on approval
    timezone: Optional[str] = Field(default="America/Sao_Paulo", max_length=64, pattern=r"^[A-Za-z_+\-/0-9]*$")


@router.get("/api/gaming/publications")
async def list_pubs():
    items = sorted(_load_pubs(), key=lambda p: -p["created_at"])
    return {"items": items, "upload_post_configured": bool(os.environ.get("UPLOAD_POST_API_KEY")),
            "postiz_configured": postiz.configured()}


@router.post("/api/gaming/publications")
async def queue_pub(body: PubIn):
    if body.scheduled_at:
        try:
            datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Data de agendamento inválida")
    plats = [p for p in body.platforms if p in ("tiktok", "instagram", "youtube")]
    if not plats:
        raise HTTPException(status_code=400, detail="Escolha ao menos uma rede: tiktok, instagram, youtube")
    item = {"id": uuid.uuid4().hex[:12], "job_id": body.job_id, "clip_index": body.clip_index,
            "platforms": plats, "user_id": body.user_id or os.environ.get("UPLOAD_POST_USER") or None,
            "title": (body.title or "")[:100], "description": (body.description or "")[:2200],
            "scheduled_at": body.scheduled_at or None, "timezone": body.timezone or "America/Sao_Paulo",
            "status": "aguardando_aprovacao", "created_at": time.time(), "log": []}
    with _PUB_LOCK:
        items = _load_pubs()
        items.append(item)
        _save_pubs(items)
    return item


def _clip_file(job_id, index):
    """Local path of the clip file a publication refers to, or None."""
    from urllib.parse import unquote
    metas = glob.glob(os.path.join(_out(), job_id, "*_metadata.json"))
    if not metas:
        return None
    with open(metas[0], "r", encoding="utf-8") as f:
        shorts = json.load(f).get("shorts") or []
    if not 0 <= index < len(shorts):
        return None
    url = _clip_url(job_id, metas[0], index, shorts[index])
    if not url:
        return None
    path = os.path.join(os.path.dirname(metas[0]), unquote(url.rsplit("/", 1)[-1].split("?")[0]))
    return path if os.path.isfile(path) else None


def _postiz_url_from_header(value):
    # Only an https address typed in Settings; anything else falls back to the env/default.
    value = (value or "").strip()
    return value if value.lower().startswith("https://") and len(value) < 300 else None


async def _approve_with_postiz(pub_id, item, key, url_header):
    path = _clip_file(item["job_id"], item["clip_index"])
    ok, detail, result = False, None, None
    if not path:
        detail = "O vídeo deste corte não foi encontrado no disco."
    else:
        text = (item.get("description") or item.get("title") or "").strip()
        try:
            result = await asyncio.to_thread(postiz.publish, path, item["platforms"], item.get("title") or "",
                                             text, item.get("scheduled_at"), key, _postiz_url_from_header(url_header))
            ok = True
        except postiz.PostizError as e:
            detail = str(e)
        except httpx.HTTPError as e:
            detail = f"Não foi possível falar com o Postiz ({type(e).__name__})."
    with _PUB_LOCK:
        items = _load_pubs()
        for p in items:
            if p["id"] == pub_id:
                p["status"] = ("agendado" if item.get("scheduled_at") else "enviado") if ok else "falhou"
                p["approved_at"] = time.time()
                p["provider"] = "postiz"
                p["log"].append({"at": time.time(), "status": 200 if ok else 502, "provider": "postiz",
                                 "detail": detail, "postiz": (result or {}).get("integrations")})
                item = p
        _save_pubs(items)
    if not ok:
        raise HTTPException(status_code=502, detail=detail or "Falha ao publicar pelo Postiz")
    return item


@router.post("/api/gaming/postiz/check")
async def postiz_check(request: Request):
    """Test the Postiz key and list which networks are connected there."""
    key = request.headers.get("x-postiz-key")
    if not postiz.configured(key):
        return {"configured": False}
    try:
        items = await asyncio.to_thread(postiz.integrations, key, _postiz_url_from_header(request.headers.get("x-postiz-url")))
    except postiz.PostizError as e:
        return {"configured": True, "ok": False, "error": str(e)}
    except httpx.HTTPError as e:
        return {"configured": True, "ok": False, "error": f"Não foi possível falar com o Postiz ({type(e).__name__})."}
    return {"configured": True, "ok": True, "accounts": [
        {"network": str(i.get("identifier") or i.get("providerIdentifier") or ""), "name": i.get("name"),
         "active": not i.get("disabled") and not i.get("refreshNeeded")} for i in items]}


@router.post("/api/gaming/publications/{pub_id}/approve")
async def approve_pub(pub_id: str, request: Request):
    _check_id(pub_id, "pub_id")
    with _PUB_LOCK:
        items = _load_pubs()
        item = next((p for p in items if p["id"] == pub_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Publicação não encontrada")
        if item["status"] not in ("aguardando_aprovacao", "falhou"):
            raise HTTPException(status_code=409, detail=f"Publicação já está '{item['status']}'")
    pz_key = request.headers.get("x-postiz-key")
    if postiz.configured(pz_key):
        return await _approve_with_postiz(pub_id, item, pz_key, request.headers.get("x-postiz-url"))
    payload = {"job_id": item["job_id"], "clip_index": item["clip_index"], "platforms": item["platforms"],
               "title": item["title"] or None, "description": item["description"] or None,
               "user_id": item.get("user_id")}
    if item.get("scheduled_at"):
        payload["scheduled_date"] = item["scheduled_at"]
        payload["timezone"] = item.get("timezone") or "America/Sao_Paulo"
    headers = {k: v for k, v in request.headers.items()
               if k.lower() in ("x-upload-post-key", "authorization", "x-api-key", "cookie")}
    transport = httpx.ASGITransport(app=_STATE["app"])
    async with httpx.AsyncClient(transport=transport, base_url="http://internal", timeout=600) as c:
        r = await c.post("/api/social/post", json=payload, headers=headers)
    ok = r.status_code < 300
    try:
        detail = r.json()
    except ValueError:
        detail = {"text": r.text[:500]}
    with _PUB_LOCK:
        items = _load_pubs()
        for p in items:
            if p["id"] == pub_id:
                p["status"] = ("agendado" if item.get("scheduled_at") else "enviado") if ok else "falhou"
                p["approved_at"] = time.time()
                p["log"].append({"at": time.time(), "status": r.status_code,
                                 "detail": detail.get("detail") if isinstance(detail, dict) else str(detail)[:300]})
                item = p
        _save_pubs(items)
    if not ok:
        raise HTTPException(status_code=r.status_code, detail=(detail.get("detail") if isinstance(detail, dict) else None)
                            or "Falha ao publicar")
    return item


@router.delete("/api/gaming/publications/{pub_id}")
async def cancel_pub(pub_id: str):
    _check_id(pub_id, "pub_id")
    with _PUB_LOCK:
        items = _load_pubs()
        for p in items:
            if p["id"] == pub_id:
                if p["status"] == "enviado":
                    raise HTTPException(status_code=409, detail="Já enviado; cancele na própria rede social")
                p["status"] = "cancelado"
                p["log"].append({"at": time.time(), "status": "cancelado"})
                _save_pubs(items)
                return p
    raise HTTPException(status_code=404, detail="Publicação não encontrada")


# --------------------------------------------------------------------------- #
# System status (Configurações)
# --------------------------------------------------------------------------- #
def _dir_bytes(path):
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(root, name))
            except OSError:
                pass
    return total


@router.get("/api/gaming/system")
async def system_status():
    import shutil
    import subprocess
    ffmpeg = None
    try:
        out = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=10)
        ffmpeg = out.stdout.splitlines()[0] if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        retention = int(os.environ.get("JOB_RETENTION_SECONDS", "86400"))
    except ValueError:
        retention = 86400
    usage = shutil.disk_usage(_out())
    return {
        "ffmpeg": ffmpeg,
        "whisper_model": os.environ.get("WHISPER_MODEL", "small"),
        "whisper_device": os.environ.get("WHISPER_DEVICE", "cpu"),
        "encoder": os.environ.get("FFMPEG_ENCODER", "x264"),
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY")),
        "upload_post_configured": bool(os.environ.get("UPLOAD_POST_API_KEY")),
        "retention_seconds": retention,
        "output_max_gb": int(os.environ.get("OUTPUT_MAX_GB", "25") or 0),
        "output_bytes": _dir_bytes(_out()),
        "disk_free_bytes": usage.free,
        "max_concurrent_jobs": int(os.environ.get("MAX_CONCURRENT_JOBS", "5") or 5),
        "games": len(library.load(_out())),
        **_queue_counts(),
    }


def _queue_counts():
    jobs = _STATE["jobs"] or {}
    return {"jobs_active": sum(1 for j in jobs.values() if j.get("status") == "processing"),
            "jobs_queued": sum(1 for j in jobs.values() if j.get("status") == "queued")}


@router.get("/api/gaming/queue")
async def queue_state():
    return _queue_counts()


# --------------------------------------------------------------------------- #
# Sede Virtual: per-agent state of a job, derived from its real log
# --------------------------------------------------------------------------- #
@router.get("/api/gaming/pipeline/{job_id}")
async def pipeline_state(job_id: str, request: Request):
    # Through /api/status in process: same ownership check, same disk fallback
    # for a job this instance no longer holds in memory.
    headers = {k: v for k, v in request.headers.items() if k.lower() in ("authorization", "x-api-key", "cookie")}
    transport = httpx.ASGITransport(app=_STATE["app"])
    async with httpx.AsyncClient(transport=transport, base_url="http://internal", timeout=30) as c:
        r = await c.get(f"/api/status/{job_id}", headers=headers)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Trabalho não encontrado.")
    st = r.json()
    logs = st.get("logs") or []
    held = ((_STATE["jobs"] or {}).get(job_id) or {}).get("logs")
    times = getattr(held, "times", None)
    if times is not None and len(times) != len(logs):
        times = None   # a filtered log view: positions no longer line up
    ready = len(((st.get("result") or {}).get("clips")) or [])
    snap = pipeline.snapshot(logs, st.get("status"), times, clips_ready=ready or None)
    snap.update(job_id=job_id, error=st.get("error"), log_lines=len(logs), **_queue_counts())
    return snap


_SELFTEST_LOCK = threading.Lock()


@router.post("/api/gaming/selftest")
def run_selftest():
    """Sync on purpose: FastAPI runs it in the threadpool, the event loop stays free."""
    if not _SELFTEST_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Um teste já está em execução.")
    try:
        report = pipeline.self_test(_out(), games_count=len(library.load(_out())))
    finally:
        _SELFTEST_LOCK.release()
    report["optional"] = [
        {"name": "Gemini (opcional)", "configured": bool(os.environ.get("GEMINI_API_KEY")),
         "detail": "Motor alternativo de análise. Exige chave do Google e pode gerar custo."},
        {"name": "Upload-Post (opcional)", "configured": bool(os.environ.get("UPLOAD_POST_API_KEY")),
         "detail": "Publicação e métricas. Serviço de terceiros; pode exigir plano pago."},
    ]
    return report


# --------------------------------------------------------------------------- #
# Social performance (views / likes), refreshed by the dashboard on a timer
# --------------------------------------------------------------------------- #
_METRIC_KEYS = {
    "views": ("views", "view_count", "impressions", "plays", "play_count", "video_views"),
    "likes": ("likes", "like_count", "digg_count", "favorites", "reactions"),
    "comments": ("comments", "comment_count"),
    "shares": ("shares", "share_count", "reposts"),
}


def _metric(row, name):
    m = row.get("post_metrics") or row.get("metrics") or row
    for key in _METRIC_KEYS[name]:
        v = m.get(key) if isinstance(m, dict) else None
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                return 0.0
    return 0.0


def aggregate_post_metrics(rows):
    """Totals, per-platform totals and the top posts from Upload-Post rows.

    The vendor's field names differ per platform (views / impressions / plays,
    likes / digg_count ...), so each metric reads the first key that exists.
    """
    totals = {k: 0 for k in _METRIC_KEYS}
    per = {}
    posts = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        vals = {k: _metric(row, k) for k in _METRIC_KEYS}
        plat = str(row.get("platform") or "outra").lower()
        p = per.setdefault(plat, {k: 0 for k in _METRIC_KEYS} | {"posts": 0})
        p["posts"] += 1
        for k, v in vals.items():
            totals[k] += v
            p[k] += v
        posts.append({
            "title": row.get("title") or row.get("caption") or row.get("youtube_title")
                     or row.get("tiktok_title") or "sem título",
            "platform": plat,
            "url": row.get("post_url") or row.get("url") or row.get("share_url"),
            "published_at": row.get("published_at") or row.get("created_at") or row.get("date"),
            **{k: round(v) for k, v in vals.items()},
        })
    posts.sort(key=lambda r: -r["views"])
    return {
        "totals": {k: round(v) for k, v in totals.items()} | {"posts": len(posts)},
        "per_platform": [{"platform": k, **{m: round(x) for m, x in v.items()}}
                         for k, v in sorted(per.items(), key=lambda kv: -kv[1]["views"])],
        "top_posts": posts[:8],
    }


@router.get("/api/gaming/metrics")
async def social_metrics(request: Request, user: Optional[str] = None, days: int = 30):
    has_key = bool(request.headers.get("x-upload-post-key") or os.environ.get("UPLOAD_POST_API_KEY"))
    profile = user or os.environ.get("UPLOAD_POST_USER")
    if not has_key or not profile:
        return {"configured": False,
                "reason": "Informe a chave e o perfil do Upload-Post em Configurações para ver visualizações e curtidas."}
    days = max(1, min(int(days), 365))
    since = time.strftime("%Y-%m-%d", time.gmtime(time.time() - days * 86400))
    headers = {k: v for k, v in request.headers.items()
               if k.lower() in ("x-upload-post-key", "authorization", "x-api-key", "cookie")}
    rows, cursor = [], None
    transport = httpx.ASGITransport(app=_STATE["app"])
    async with httpx.AsyncClient(transport=transport, base_url="http://internal", timeout=60) as c:
        for _ in range(5):
            params = {"user": profile, "since": since, "limit": 200}
            if cursor:
                params["cursor"] = cursor
            r = await c.get("/api/social/analytics/posts", params=params, headers=headers)
            if r.status_code >= 300:
                try:
                    detail = r.json().get("detail")
                except ValueError:
                    detail = r.text[:200]
                return {"configured": True, "error": f"Upload-Post respondeu {r.status_code}: {detail}",
                        "fetched_at": time.time()}
            data = r.json()
            rows += data.get("posts") or data.get("data") or data.get("items") or []
            cursor = data.get("next_cursor")
            if not cursor or not data.get("has_more"):
                break
    return {"configured": True, "days": days, "fetched_at": time.time(), **aggregate_post_metrics(rows)}
