"""Aprendizado com as visualizações (ideas 1 and 4 of the owner's list).

Every time the panel reads the networks' numbers (/api/gaming/metrics), the
posts that came from this system are tied back to the clip they came from
(by title: it is what Upload-Post returns for each post) and remembered with
the clip's moment type and the post's date. From that history:

  bonus()          small score bonus per moment type for the next jobs: the
                   kinds that get more views on THIS channel come first when
                   two candidates are otherwise close. Needs a few posts before
                   it says anything (a channel with 1 video teaches nothing).
  melhor_horario() the weekday + hour (Brasília) with the most views per post.

Kept in output/gaming/aprendizado.json; nothing leaves the codespace.
"""
import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo("America/Sao_Paulo")
except Exception:  # pragma: no cover - no tz database
    _TZ = timezone.utc

MIN_POSTS = 4          # below this the channel's history says nothing yet
MIN_POR_TIPO = 2       # a type needs this many posts to get a bonus
BONUS_MAX = 0.06       # at most +6 points on a 0-100 score (≈ 0.03 of "val")
DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def _arquivo(output_dir):
    d = os.path.join(output_dir, "gaming")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "aprendizado.json")


def carregar(output_dir):
    try:
        with open(_arquivo(output_dir), "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {"posts": {}}
    except (OSError, ValueError):
        return {"posts": {}}


def _gravar(output_dir, data):
    p = _arquivo(output_dir)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p)


def norm_titulo(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"#\w+", " ", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def _titulo_do_post(row):
    return row.get("title") or row.get("caption") or row.get("youtube_title") or row.get("tiktok_title") or ""


def _num(row, *chaves):
    m = row.get("post_metrics") or row.get("metrics") or row
    for k in chaves:
        v = m.get(k) if isinstance(m, dict) else None
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                return 0.0
    return 0.0


def atualizar(output_dir, rows, pubs, info_do_corte):
    """Remember the posts that came from our clips. info_do_corte(job_id, idx)
    returns {"moment": ..., "label": ...} or None. Returns how many matched."""
    por_titulo = {}
    for p in pubs or []:
        if p.get("status") == "enviado" and p.get("title"):
            por_titulo.setdefault(norm_titulo(p["title"]), p)
    if not por_titulo:
        return 0
    data = carregar(output_dir)
    posts = data.setdefault("posts", {})
    achados = 0
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        titulo = _titulo_do_post(row)
        pub = por_titulo.get(norm_titulo(titulo))
        if not pub:
            continue
        info = info_do_corte(pub.get("job_id"), int(pub.get("clip_index") or 0))
        if not info:
            continue
        plat = str(row.get("platform") or "outra").lower()
        quando = row.get("published_at") or row.get("created_at") or row.get("date")
        chave = row.get("post_url") or row.get("url") or f"{plat}:{norm_titulo(titulo)}:{quando}"
        posts[str(chave)] = {
            "moment": info.get("moment"), "label": info.get("label"), "plataforma": plat,
            "views": _num(row, "views", "view_count", "impressions", "plays", "play_count", "video_views"),
            "likes": _num(row, "likes", "like_count", "digg_count", "favorites", "reactions"),
            "publicado": quando, "titulo": str(titulo)[:120],
        }
        achados += 1
    data["atualizado"] = time.time()
    _gravar(output_dir, data)
    return achados


def _posts(output_dir):
    return [p for p in (carregar(output_dir).get("posts") or {}).values()
            if isinstance(p, dict) and p.get("moment")]


def ranking(output_dir):
    """Moment types by average views per post, best first."""
    posts = _posts(output_dir)
    tipos = {}
    for p in posts:
        t = tipos.setdefault(p["moment"], {"moment": p["moment"], "label": p.get("label") or p["moment"],
                                           "posts": 0, "views": 0.0, "likes": 0.0})
        t["posts"] += 1
        t["views"] += p.get("views") or 0
        t["likes"] += p.get("likes") or 0
    out = []
    for t in tipos.values():
        t["media_views"] = round(t["views"] / t["posts"])
        out.append(t)
    out.sort(key=lambda t: -t["media_views"])
    return out


def bonus(output_dir):
    """{moment: bonus} for the next jobs; empty until the history means something."""
    posts = _posts(output_dir)
    if len(posts) < MIN_POSTS:
        return {}
    media = sum(p.get("views") or 0 for p in posts) / len(posts)
    if media <= 0:
        return {}
    out = {}
    for t in ranking(output_dir):
        if t["posts"] < MIN_POR_TIPO:
            continue
        rel = t["media_views"] / media - 1.0
        out[t["moment"]] = round(max(-BONUS_MAX * 0.66, min(BONUS_MAX, BONUS_MAX * rel)), 4)
    return out


def dica_para_ia(output_dir):
    """One sentence for Gemini's prompt, or ''."""
    b = bonus(output_dir)
    melhores = [t["label"] for t in ranking(output_dir) if b.get(t["moment"], 0) > 0][:3]
    if not melhores:
        return ""
    return ("No canal deste criador, os Shorts de " + ", ".join(melhores) +
            " têm mais visualizações: prefira esses quando a qualidade for parecida.")


def _local(quando):
    try:
        s = str(quando).replace("Z", "+00:00")
        d = datetime.fromisoformat(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(_TZ)
    except (TypeError, ValueError):
        return None


def melhor_horario(output_dir):
    """Best weekday and hour (Brasília) by views per post; None while unknown."""
    posts = [p for p in _posts(output_dir) if _local(p.get("publicado"))]
    if len(posts) < MIN_POSTS:
        return None
    grupos = {}
    for p in posts:
        d = _local(p["publicado"])
        faixa = (d.weekday(), d.hour - d.hour % 2)          # 2-hour slots: fewer, fuller groups
        g = grupos.setdefault(faixa, [])
        g.append(p.get("views") or 0)
    validos = {k: v for k, v in grupos.items() if len(v) >= 2}
    if not validos:
        return None
    (dia, hora), views = max(validos.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))
    return {"dia": DIAS[dia], "dia_semana": dia, "hora": hora, "ate": hora + 2,
            "media_views": round(sum(views) / len(views)), "amostras": len(views),
            "texto": f"{DIAS[dia].capitalize()}, das {hora}h às {hora + 2}h"}


def resumo(output_dir):
    posts = _posts(output_dir)
    return {"posts": len(posts), "minimo": MIN_POSTS, "ranking": ranking(output_dir),
            "bonus": bonus(output_dir), "melhor_horario": melhor_horario(output_dir),
            "atualizado": carregar(output_dir).get("atualizado")}
