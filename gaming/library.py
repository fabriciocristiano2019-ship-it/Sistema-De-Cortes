"""Game library: a small JSON store under OUTPUT_DIR/gaming.

One file, written atomically (tmp + os.replace) under a process lock, so a
crash mid-write never leaves a truncated library. Usage statistics (videos,
clips) are NOT stored here: they are computed from the job metadata on disk,
so they can never drift from what was actually produced.
"""
import glob
import json
import os
import re
import threading
import time
import uuid

from . import profiles

_LOCK = threading.Lock()

# Starter entries only, one per category, so the library is not empty on first
# run. They are ordinary records: the user can edit or delete any of them, and
# nothing in the analysis depends on these specific titles.
SEED_GAMES = [
    {"name": "Counter-Strike 2", "category": "fps_br", "aliases": ["cs2", "cs 2", "counter strike", "cs go", "csgo"]},
    {"name": "Free Fire", "category": "fps_br", "aliases": ["ff", "freefire", "free fire max"]},
    {"name": "Fortnite", "category": "fps_br", "aliases": ["fortnite"]},
    {"name": "GTA V", "category": "open_world", "aliases": ["gta", "gta 5", "gta v", "gta rp", "grand theft auto"]},
    {"name": "Minecraft", "category": "survival", "aliases": ["minecraft", "mine"]},
    {"name": "League of Legends", "category": "strategy", "aliases": ["lol", "league", "league of legends"]},
    {"name": "Elden Ring", "category": "rpg", "aliases": ["elden ring", "elden"]},
    {"name": "Phasmophobia", "category": "horror", "aliases": ["phasmophobia", "phasmo"]},
    {"name": "Forza Horizon 5", "category": "racing", "aliases": ["forza", "forza horizon"]},
    {"name": "EA Sports FC", "category": "sports", "aliases": ["fifa", "ea fc", "fc 25", "fc 26", "ea sports fc"]},
    {"name": "Euro Truck Simulator 2", "category": "simulator", "aliases": ["euro truck", "ets2", "ets 2"]},
    {"name": "Fall Guys", "category": "casual", "aliases": ["fall guys"]},
]

DEFAULT_PREFS = {
    "clip_seconds": 30,       # 15 | 30 | 45 | 60 | custom
    "layout": "auto",         # full | webcam | vertical | auto  (see app.GAMING_LAYOUTS)
    "captions": True,
    "caption_style": "karaoke",
    "zoom": True,             # punch-in on peaks
    "auto_hook": True,
    "max_clips": 8,
    "min_score": 30,
}


def _root(output_dir):
    d = os.path.join(output_dir, "gaming")
    os.makedirs(os.path.join(d, "covers"), exist_ok=True)
    return d


def _path(output_dir):
    return os.path.join(_root(output_dir), "games.json")


def _new_id(name):
    slug = re.sub(r"[^a-z0-9]+", "-", profiles.strip_accents(name)).strip("-")[:40] or "jogo"
    return f"{slug}-{uuid.uuid4().hex[:6]}"


# Accepted values per preference: anything else keeps the default, so a
# crafted request cannot store an unexpected type or value in games.json.
_PREF_RULES = {
    "clip_seconds": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and 5 <= v <= 180,
    "layout": lambda v: v in ("auto", "full", "webcam", "vertical"),
    "captions": lambda v: isinstance(v, bool),
    "caption_style": lambda v: isinstance(v, str) and re.fullmatch(r"[a-z_-]{1,20}", v) is not None,
    "zoom": lambda v: isinstance(v, bool),
    "auto_hook": lambda v: isinstance(v, bool),
    "max_clips": lambda v: isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 30,
    "min_score": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 100,
}


def clean_prefs(raw):
    prefs = dict(DEFAULT_PREFS)
    if isinstance(raw, dict):
        for k, v in raw.items():
            rule = _PREF_RULES.get(k)
            if rule and rule(v):
                prefs[k] = v
    return prefs


def _normalise(g):
    g = dict(g)
    g["name"] = str(g.get("name") or "").strip()[:80]
    if g.get("category") not in profiles.CATEGORIES:
        g["category"] = "other"
    aliases = g.get("aliases") or []
    if isinstance(aliases, str):
        aliases = [a for a in re.split(r"[,;\n]", aliases)]
    g["aliases"] = sorted({a.strip().lower()[:40] for a in aliases if a and a.strip()})[:20]
    g["preferences"] = clean_prefs(g.get("preferences"))
    g["analysis_profile"] = g["category"]
    g.setdefault("cover", None)
    g.setdefault("created_at", time.time())
    return g


def load(output_dir):
    p = _path(output_dir)
    with _LOCK:
        if not os.path.exists(p):
            games = [_normalise({**s, "id": _new_id(s["name"]), "seed": True}) for s in SEED_GAMES]
            _write(p, games)
            return games
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            return [_normalise(g) for g in data.get("games", [])]
        except (OSError, ValueError) as e:
            # Keep the unreadable file for inspection; never silently overwrite it.
            bad = p + f".corrupt-{int(time.time())}"
            try:
                os.replace(p, bad)
            except OSError:
                pass
            print(f"⚠️ games.json unreadable ({e}); moved to {bad}")
            return []


def _write(p, games):
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "games": games}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def save_all(output_dir, games):
    with _LOCK:
        _write(_path(output_dir), [_normalise(g) for g in games])


def get(output_dir, game_id):
    return next((g for g in load(output_dir) if g["id"] == game_id), None)


def create(output_dir, data):
    if not str(data.get("name") or "").strip():
        raise ValueError("nome do jogo é obrigatório")
    games = load(output_dir)
    if any(g["name"].lower() == data["name"].strip().lower() for g in games):
        raise ValueError("já existe um jogo com esse nome")
    g = _normalise({**data, "id": _new_id(data["name"]), "created_at": time.time()})
    games.append(g)
    save_all(output_dir, games)
    return g


def update(output_dir, game_id, data):
    games = load(output_dir)
    for i, g in enumerate(games):
        if g["id"] == game_id:
            merged = {**g, **{k: v for k, v in data.items() if k not in ("id", "created_at")}}
            if "preferences" in data:
                merged["preferences"] = {**g.get("preferences", {}), **(data.get("preferences") or {})}
            games[i] = _normalise(merged)
            save_all(output_dir, games)
            return games[i]
    return None


def delete(output_dir, game_id):
    games = load(output_dir)
    keep = [g for g in games if g["id"] != game_id]
    if len(keep) == len(games):
        return False
    save_all(output_dir, keep)
    # The cover goes too; produced clips stay (they belong to their jobs).
    for c in glob.glob(os.path.join(_root(output_dir), "covers", f"{game_id}.*")):
        try:
            os.remove(c)
        except OSError:
            pass
    return True


def identify(output_dir, filename="", transcript=None):
    """Guess the game from the file name and what the player says.

    Only names and aliases in the library can be recognised; anything else is
    reported as unknown so the user picks or registers it. Returns candidates
    sorted by score with the evidence for each.
    """
    text_name = profiles.strip_accents(os.path.basename(filename or ""))
    text_name = re.sub(r"[_\-.]+", " ", text_name)
    speech = " ".join(s.get("text", "") for s in (transcript or {}).get("segments", []) or [])
    text_speech = profiles.strip_accents(speech)
    out = []
    for g in load(output_dir):
        terms = {profiles.strip_accents(g["name"])} | {profiles.strip_accents(a) for a in g["aliases"]}
        score, why = 0.0, []
        for t in terms:
            if len(t) < 2:
                continue
            pat = re.compile(r"(?<![a-z0-9])" + re.escape(t) + r"(?![a-z0-9])")
            if pat.search(text_name):
                score += 3.0 if len(t) > 3 else 1.5
                why.append(f'nome do arquivo contém "{t}"')
            k = len(pat.findall(text_speech))
            if k:
                score += min(3.0, 0.75 * k) * (1.0 if len(t) > 3 else 0.4)
                why.append(f'"{t}" citado {k}x na fala')
        if score > 0:
            out.append({"game_id": g["id"], "name": g["name"], "category": g["category"],
                        "score": round(score, 2), "evidence": why[:4]})
    out.sort(key=lambda c: -c["score"])
    best = out[0] if out else None
    confidence = "nenhuma"
    if best:
        margin = best["score"] - (out[1]["score"] if len(out) > 1 else 0)
        confidence = "alta" if best["score"] >= 3 and margin >= 1.5 else "média" if best["score"] >= 1.5 else "baixa"
    return {"best": best, "confidence": confidence, "candidates": out[:5]}


def display_source(job_id, name):
    """Uploads are stored as "<job_id>_<original name>"; show the original."""
    name = str(name or "")
    return name[len(job_id) + 1:] if name.startswith(f"{job_id}_") else name


def stats(output_dir):
    """Per-game usage computed from job metadata on disk."""
    per = {}
    for meta in glob.glob(os.path.join(output_dir, "*", "*_metadata.json")):
        try:
            with open(meta, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            continue
        gid = (data.get("gaming") or {}).get("game_id")
        if not gid:
            continue
        job_id = os.path.basename(os.path.dirname(meta))
        s = per.setdefault(gid, {"videos": 0, "clips": 0, "history": []})
        n = len(data.get("shorts") or [])
        s["videos"] += 1
        s["clips"] += n
        s["history"].append({
            "job_id": job_id,
            "source": display_source(job_id, data.get("source_video")),
            "clips": n,
            "created_at": os.path.getmtime(meta),
        })
    for s in per.values():
        s["history"].sort(key=lambda h: -h["created_at"])
        s["history"] = s["history"][:50]
    return per
