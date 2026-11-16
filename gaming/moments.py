"""Local highlight detection for any game.

Pipeline (all local, no API):
  1. audio features   (loudness peaks, sudden spikes)        - gaming.signals
  2. visual features  (motion, hard cuts, flashes, red screen) - gaming.signals
  3. transcript cues  (moment lexicon, laughter, speech rate)  - gaming.profiles
  4. per-genre weighted sum -> peaks -> evidence gate -> clips with context

A peak only becomes a clip when at least one signal is clearly above its own
baseline (EVIDENCE_Z). Flat footage yields no clips rather than random ones,
and every clip carries the evidence that selected it.
"""
import hashlib
import math
import re

import numpy as np

from . import profiles, signals
from .signals import STEP

EVIDENCE_NORM = 0.55       # a signal at >= this (≈ z 2.2) counts as real evidence
DEFAULT_MIN_SCORE = 30
CONTEXT_BEFORE = 0.65      # peak sits at 65% of the clip: setup first, payoff, short tail

SPECIFICITY = {
    "headshot": 1.0, "clutch": 1.0, "vitoria": 0.9, "eliminacao": 0.8, "conquista": 0.8,
    "engracado": 0.8, "derrota": 0.7, "jogada": 0.7, "susto": 0.7, "descoberta": 0.6,
    "perseguicao": 0.6, "inesperado": 0.6, "tensao": 0.5, "reacao": 0.35,
}

# Where each signal comes from. Two signals of the same source can be one
# event seen twice (a hard scene cut is both "motion" and "flash"), so the
# evidence gate counts sources, not signals.
MODALITY = {
    "audio_peak": "audio", "audio_spike": "audio",
    "motion": "visual", "flash": "visual", "red": "visual",
    "keyword": "speech", "laughter": "speech", "speech_rate": "speech",
}
# An audio track whose loudness barely moves (digital silence, a constant
# hum) says nothing about moments; below this p10..p99 range it is ignored.
MIN_AUDIO_RANGE_DB = 4.0
# A peak this far above the ordinary level (0.9 ≈ 11 dB over normal talking)
# is a scream or an explosion and stands as evidence without a second source.
LOUD_ALONE = 0.9


def has_evidence(strong, audio_usable, sustained_visual=True, audio_peak=0.0):
    """Is this set of clearly-above-baseline signals a real moment?

    - the player's own words or laughter name a moment by themselves;
    - otherwise two different sources must agree (sound + picture, sound +
      speech rate, ...);
    - sound alone counts only when it is exceptionally loud (a scream, an
      explosion) or both loud AND sudden, which ordinary speech starting
      after a pause is not;
    - picture alone never counts while there is usable audio: a menu or a
      scene transition changes the image and nothing else;
    - with no usable audio, two visual signals that last (not a one-frame
      cut) are all there is to go on, and are accepted.
    """
    strong = set(strong)
    if strong & {"keyword", "laughter"}:
        return True
    sources = {MODALITY[k] for k in strong if k in MODALITY}
    if not audio_usable:
        return len(strong & {"motion", "flash", "red"}) >= 2 and sustained_visual
    if len(sources) >= 2:
        return True
    return sources == {"audio"} and (len(strong) >= 2 or audio_peak >= LOUD_ALONE)


SIGNAL_LABELS = {
    "audio_peak": "pico de volume", "audio_spike": "aumento súbito de áudio",
    "motion": "muita ação na tela", "cut": "mudança brusca de cena", "flash": "clarão na tela",
    "red": "tela vermelha (dano)", "keyword": "fala do jogador", "laughter": "risadas",
    "speech_rate": "fala acelerada",
}

TITLE_TEMPLATES = {
    "eliminacao": ["Eliminação brabíssima no {game}", "Ninguém escapa: kill no {game}", "Que eliminação no {game}!"],
    "headshot": ["HEADSHOT INSANO no {game}", "Um tiro, uma capa: {game}", "Mira absurda no {game}"],
    "vitoria": ["VITÓRIA no {game}!", "Ganhamos no {game} assim", "O final dessa partida de {game}"],
    "derrota": ["Perdi do jeito mais doído no {game}", "Não acredito nessa derrota no {game}", "Quase… {game}"],
    "clutch": ["Clutch impossível no {game}", "Sobrou só eu no {game}…", "1 contra todos no {game}"],
    "jogada": ["Jogada INSANA no {game}", "Isso foi surreal no {game}", "Melhor jogada da live de {game}"],
    "engracado": ["Morri de rir no {game} 😂", "O {game} me trollou", "Momento mais engraçado no {game}"],
    "susto": ["Que SUSTO no {game}!", "Quase infartei jogando {game}", "Não jogue {game} de madrugada"],
    "reacao": ["Minha reação no {game}", "Olha o que aconteceu no {game}", "Ninguém esperava isso no {game}"],
    "perseguicao": ["Perseguição insana no {game}", "Fugindo de tudo no {game}", "Corre! {game}"],
    "conquista": ["FINALMENTE consegui no {game}", "Conquista desbloqueada no {game}", "Valeu a pena: {game}"],
    "descoberta": ["Achei um segredo no {game}", "Você sabia disso no {game}?", "Olha o que eu encontrei no {game}"],
    "inesperado": ["Do nada isso no {game}", "O {game} me surpreendeu", "Ninguém explica isso no {game}"],
    "tensao": ["Tensão máxima no {game}", "Último suspiro no {game}", "Coração na boca no {game}"],
}

HOOKS = {
    "eliminacao": "QUE KILL!", "headshot": "HEADSHOT!", "vitoria": "VITÓRIA!", "derrota": "NÃO ACREDITO",
    "clutch": "CLUTCH!", "jogada": "QUE JOGADA!", "engracado": "KKKKKK", "susto": "QUE SUSTO!",
    "reacao": "OLHA ISSO", "perseguicao": "CORRE!", "conquista": "CONSEGUI!", "descoberta": "OLHA O QUE ACHEI",
    "inesperado": "DO NADA…", "tensao": "TENSÃO MÁXIMA",
}

MOMENT_TAGS = {
    "eliminacao": "kill", "headshot": "headshot", "vitoria": "vitoria", "derrota": "derrota", "clutch": "clutch",
    "jogada": "jogada", "engracado": "engracado", "susto": "susto", "reacao": "reacao", "perseguicao": "perseguicao",
    "conquista": "conquista", "descoberta": "segredo", "inesperado": "inesperado", "tensao": "tensao",
}


def fmt_ts(sec):
    sec = max(0, int(round(sec)))
    return f"{sec // 3600:02d}:{sec % 3600 // 60:02d}:{sec % 60:02d}"


def _fit(arr, n):
    arr = np.asarray(arr, dtype=float)
    if len(arr) >= n:
        return arr[:n]
    return np.pad(arr, (0, n - len(arr)))


def _norm(z, full=4.0):
    return np.clip(np.asarray(z) / full, 0, 1)


def _words(transcript):
    out = []
    for seg in (transcript or {}).get("segments", []) or []:
        for w in seg.get("words", []) or []:
            try:
                out.append({"w": str(w.get("word", "")), "s": float(w["start"]), "e": float(w["end"])})
            except (KeyError, TypeError, ValueError):
                continue
    return out


def transcript_features(transcript, n):
    """keyword, laughter, speech_rate arrays + list of (time, moment, text) hits."""
    kw = np.zeros(n)
    laugh = np.zeros(n)
    wcount = np.zeros(n)
    hits = []
    words = _words(transcript)
    for w in words:
        i = min(n - 1, int(w["s"] / STEP)) if n else 0
        if n:
            wcount[i] += 1
    # Lexicon: slide a 4-word phrase so multi-word patterns ("meu deus") match,
    # and place each hit at the word that starts it.
    for idx in range(len(words)):
        phrase = " ".join(x["w"].strip() for x in words[idx: idx + 4])
        first = profiles.strip_accents(words[idx]["w"]).strip(" .,!?…\"'")
        if not first:
            continue
        found = profiles.match_moments(phrase)
        t = words[idx]["s"]
        i = min(n - 1, int(t / STEP))
        for moment, matches in found.items():
            m0 = profiles.strip_accents(matches[0]).split()[0] if matches else ""
            if m0 and not first.startswith(m0[: max(2, len(m0) - 1)]) and not m0.startswith(first[:3]):
                continue  # the phrase match belongs to a later word; it will be counted there
            kw[i] += SPECIFICITY.get(moment, 0.5) * 2.0
            hits.append((t, moment, matches[0]))
        if profiles.LAUGH_RE.search(profiles.strip_accents(words[idx]["w"])):
            laugh[i] += 2.0
    if not words:  # segment-level fallback (some backends give no word timings)
        for seg in (transcript or {}).get("segments", []) or []:
            try:
                t = float(seg["start"])
            except (KeyError, TypeError, ValueError):
                continue
            i = min(n - 1, int(t / STEP))
            for moment, matches in profiles.match_moments(seg.get("text", "")).items():
                kw[i] += SPECIFICITY.get(moment, 0.5) * 2.0
                hits.append((t, moment, matches[0]))
            if profiles.LAUGH_RE.search(profiles.strip_accents(seg.get("text", ""))):
                laugh[i] += 2.0
    k = max(1, int(2 / STEP))
    rate = np.convolve(wcount, np.ones(k), mode="same")
    speech = signals.robust_z_active(rate, q=50.0, floor=1.5) if rate.any() else rate
    return {"keyword": kw, "laughter": laugh, "speech_rate": speech}, hits


def _smooth(x, steps):
    if steps <= 1 or len(x) == 0:
        return x
    return np.convolve(x, np.ones(steps) / steps, mode="same")


def _spread_max(x, steps):
    """Each sample takes the max of its neighbourhood: a word said 1 s after an
    explosion should reinforce the same peak, not form a second one."""
    if steps <= 1 or len(x) == 0:
        return x
    pad = steps // 2
    xp = np.pad(x, (pad, pad), mode="edge")
    return np.max(np.lib.stride_tricks.sliding_window_view(xp, steps), axis=1)[: len(x)]


def _snap(t, words, segments, lo, hi, prefer="start"):
    """Move a cut into a pause near t (within [lo, hi]); keeps phrases whole."""
    best, best_d = t, None
    if prefer == "start":
        cands = [s for s in segments if lo <= s <= hi]
        cands += [words[i + 1]["s"] - 0.15 for i in range(len(words) - 1)
                  if words[i + 1]["s"] - words[i]["e"] >= 0.3 and lo <= words[i + 1]["s"] - 0.15 <= hi]
    else:
        cands = [w["e"] + 0.25 for i, w in enumerate(words)
                 if (i + 1 == len(words) or words[i + 1]["s"] - w["e"] >= 0.3) and lo <= w["e"] + 0.25 <= hi]
    for c in cands:
        d = abs(c - t)
        if best_d is None or d < best_d:
            best, best_d = c, d
    return best


def _excerpt(words, start, end, limit=140):
    text = " ".join(w["w"].strip() for w in words if start <= w["s"] < end).strip()
    text = re.sub(r"\s+", " ", text)
    return (text[: limit - 1] + "…") if len(text) > limit else text


def _pick(options, seed):
    h = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    return options[h % len(options)]


def _slug_tag(name):
    s = profiles.strip_accents(name)
    return re.sub(r"[^a-z0-9]", "", s) or "games"


def build_copy(game_name, moment, excerpt, seed):
    """Template titles/descriptions in PT-BR. Deterministic per clip."""
    g = game_name or "game"
    title = _pick(TITLE_TEMPLATES.get(moment, TITLE_TEMPLATES["reacao"]), seed).format(game=g)
    label = profiles.MOMENTS.get(moment, {}).get("label", "Momento")
    tags = [f"#{_slug_tag(g)}", f"#{MOMENT_TAGS.get(moment, 'gaming')}", "#gaming", "#gameplay", "#cortes"]
    quote = f' "{excerpt[:90]}"' if excerpt else ""
    desc = f"{label} em {g}.{quote}".strip()
    return {
        "video_title_for_youtube_short": title[:95],
        "video_description_for_tiktok": f"{desc} {' '.join(tags)} #fyp",
        "video_description_for_instagram": f"{desc}\n\n{' '.join(tags)} #reels",
        "description": desc,
        "hashtags": tags,
        "viral_hook_text": HOOKS.get(moment, "OLHA ISSO"),
    }


def detect_moments(video_path, transcript, duration, game=None, settings=None,
                   should_cancel=None, log=print, features=None):
    """Return {"shorts": [...], "analysis": {...}}; shorts may be empty.

    game: {"id","name","category"}; settings: clip_seconds, max_clips, min_score,
    moments (optional whitelist of moment ids).
    """
    game = game or {}
    settings = settings or {}
    cat_id = game.get("category") or "other"
    prof = profiles.category(cat_id)
    weights = dict(prof["weights"])
    clip_len = float(settings.get("clip_seconds") or 30)
    clip_len = max(5.0, min(clip_len, 180.0))
    max_clips = int(settings.get("max_clips") or 8)
    min_score = float(settings.get("min_score") if settings.get("min_score") is not None else DEFAULT_MIN_SCORE)
    allowed = set(settings.get("moments") or [])
    duration = float(duration or signals.media_duration(video_path) or 0)
    if duration <= 0:
        return {"shorts": [], "analysis": {"error": "duração do vídeo desconhecida"}}
    clip_len = min(clip_len, duration)
    n = max(1, int(math.ceil(duration / STEP)))

    if features is None:
        log("🎧 Análise de áudio (local)...")
        af = signals.audio_features(video_path, should_cancel)
        log("👁️ Análise visual (local)...")
        vf = signals.visual_features(video_path, should_cancel)
    else:
        af, vf = features
    has_audio = len(af["rms_db"]) > 0
    audio_usable = bool(has_audio and float(
        np.percentile(af["rms_db"], 99) - np.percentile(af["rms_db"], 10)) >= MIN_AUDIO_RANGE_DB)
    tf, hits = transcript_features(transcript, n)
    win = int(60 / STEP)
    log(f"✂️ Selecionando janelas de {int(round(clip_len))}s com contexto "
        f"(picos de áudio, imagem e fala)...")

    raw = {
        "audio_peak": _norm(signals.level_above_active(_fit(af["rms_db"], n), 3.0)) if audio_usable else np.zeros(n),
        "audio_spike": _norm(signals.level_above_active(_fit(af["spike_db"], n), 3.0)) if audio_usable else np.zeros(n),
        "motion": _norm(signals.robust_z(_fit(vf["motion"], n), win, floor=2.0)),
        "cut": _fit(vf["cut"], n),
        "flash": _norm(signals.robust_z(_fit(vf["flash"], n), floor=4.0), 5.0),
        "red": _norm(signals.robust_z(_fit(vf["red"], n), floor=0.03), 5.0),
        "keyword": np.clip(_fit(tf["keyword"], n) / 2.0, 0, 1),
        "laughter": np.clip(_fit(tf["laughter"], n) / 2.0, 0, 1),
        "speech_rate": _norm(_fit(tf["speech_rate"], n)),
    }
    if not audio_usable:  # redistribute audio weight to visuals instead of scoring zero
        moved = weights.pop("audio_peak", 0) + weights.pop("audio_spike", 0)
        for k in ("motion", "flash", "cut", "red"):
            weights[k] = weights.get(k, 0) + moved / 4
        weights.setdefault("audio_peak", 0)
        weights.setdefault("audio_spike", 0)

    spread = int(3 / STEP)
    feats = {k: _spread_max(v, spread) for k, v in raw.items()}
    combined = sum(weights.get(k, 0) * feats[k] for k in feats)
    combined = _smooth(combined, int(2 / STEP))
    # Evidence mask: some single signal is clearly above its own baseline.
    evidence_max = np.max(np.stack([feats[k] for k in feats if k != "cut"]), axis=0)

    words = _words(transcript)
    seg_starts = [float(s.get("start", 0)) for s in (transcript or {}).get("segments", []) or []]
    hit_times = np.array([h[0] for h in hits]) if hits else np.zeros(0)
    boost = set(prof.get("boost", []))

    order = np.argsort(-combined)
    taken = []
    shorts = []
    rejected_low = 0
    rejected_single = 0
    for idx in order:
        if len(shorts) >= max_clips:
            break
        peak_t = idx * STEP
        if any(abs(peak_t - t) < clip_len * 0.8 for t in taken):
            continue
        val = float(combined[idx])
        if evidence_max[idx] < EVIDENCE_NORM:
            continue
        # One lone signal is not a moment: a sentence starting after silence is
        # an "audio rise" too, and a scene cut is "motion" and "flash" at once.
        # See has_evidence for what does count.
        strong = [k for k in feats if k != "cut" and feats[k][idx] >= EVIDENCE_NORM]
        lo, hi = max(0, idx - spread), min(n, idx + spread + 1)
        sustained = int(np.sum(raw["motion"][lo:hi] >= EVIDENCE_NORM)) >= 2
        if not has_evidence(strong, audio_usable, sustained, float(feats["audio_peak"][idx])):
            rejected_single += 1
            continue
        # Category: transcript words near the peak win; else the dominant signal.
        moment, moment_score, quote = None, 0.0, None
        if len(hit_times):
            near = np.where((hit_times >= peak_t - 6) & (hit_times <= peak_t + 4))[0]
            # Every nearby cue votes: "meu deus, que susto, socorro" is three
            # votes for a scare and outweighs one stray "não acredito".
            votes, quotes = {}, {}
            for j in near:
                _, m, txt = hits[j]
                votes[m] = votes.get(m, 0.0) + SPECIFICITY.get(m, 0.5)
                quotes.setdefault(m, txt)
            for m, v in votes.items():
                s = min(v, 2.5) + (0.3 if m in boost else 0)
                if s > moment_score:
                    moment, moment_score, quote = m, s, quotes[m]
        contrib = {k: weights.get(k, 0) * feats[k][idx] for k in feats}
        dominant = max((k for k in contrib if k != "keyword"), key=lambda k: contrib[k])
        if moment is None:
            moment = profiles.SIGNAL_MOMENT.get(dominant, "reacao")
        if moment in boost:
            val += 0.05
        score = int(round(min(100, val / 0.5 * 100)))
        if score < min_score:
            rejected_low += 1
            continue
        if allowed and moment not in allowed:
            continue

        start = peak_t - clip_len * CONTEXT_BEFORE
        start = max(0.0, min(start, duration - clip_len))
        start = max(0.0, _snap(start, words, seg_starts, start - 2.0, min(start + 1.5, peak_t - 1.0), "start"))
        end = min(duration, start + clip_len)
        end = _snap(end, words, seg_starts, max(peak_t + 1.0, end - 1.5), min(duration, end + 2.0), "end")
        end = min(duration, max(end, start + min(clip_len, 5.0)))
        if any(not (end <= s["start"] or start >= s["end"]) for s in shorts):
            continue

        evidence = []
        for k, v in sorted(contrib.items(), key=lambda kv: -kv[1]):
            if feats[k][idx] >= EVIDENCE_NORM and len(evidence) < 4:
                evidence.append(SIGNAL_LABELS[k] + (f': "{quote}"' if k == "keyword" and quote else ""))
        excerpt = _excerpt(words, start, end)
        copy = build_copy(game.get("name"), moment, excerpt, f"{game.get('id')}-{start:.1f}")
        clip = {
            "start": round(float(start), 3),
            "end": round(float(end), 3),
            "peak_time": round(float(peak_t), 2),
            "start_timecode": fmt_ts(start),
            "end_timecode": fmt_ts(end),
            "predicted_score": score,
            "relevance_score": score,
            "moment_category": moment,
            "moment_label": profiles.MOMENTS.get(moment, {}).get("label", moment),
            "evidence": evidence,
            "transcript_excerpt": excerpt,
            "game_id": game.get("id"),
            "game_name": game.get("name"),
            "game_category": cat_id,
            "analysis_engine": "local",
            "approved": None,
        }
        clip.update(copy)
        shorts.append(clip)
        taken.append(peak_t)

    shorts.sort(key=lambda c: c["start"])
    analysis = {
        "engine": "local",
        "duration": round(duration, 2),
        "has_audio": has_audio,
        "audio_usable": audio_usable,
        "transcript_words": len(words),
        "keyword_hits": len(hits),
        "candidates_below_min_score": rejected_low,
        "candidates_single_signal": rejected_single,
        "weights": weights,
        "clip_seconds": clip_len,
        "min_score": min_score,
    }
    log(f"🎮 {len(shorts)} momento(s) com evidência encontrados.")
    return {"shorts": shorts, "analysis": analysis}
