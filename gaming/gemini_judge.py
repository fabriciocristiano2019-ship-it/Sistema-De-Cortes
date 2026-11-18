"""Gemini as the professional editor of a Gaming Edition job.

The local engine (gaming.moments) proposes a wide pool of candidate windows,
each backed by measured evidence (audio peaks, motion, keywords). Gemini then
does what rules cannot: it looks at 3 frames of every candidate, reads what the
player said, keeps the moments a viewer would actually watch, nudges the cut
points, and writes the title, description, hashtags and hook in PT-BR. It also
returns spelling fixes for words the transcription got wrong (game terms,
names), applied word by word so caption timings stay intact.

Cost is bounded and does not grow with the video length: at most MAX_CANDIDATES
candidates x 3 frames at 512 px, plus their transcript excerpts. Any failure
(no key, network, quota, malformed answer) returns None and the caller keeps
the local result, so a job never fails because of Gemini.
"""
import json
import os
import re
from typing import List

from pydantic import BaseModel, Field

from gaming import profiles

MAX_CANDIDATES = 12
MAX_POOL = 36
FRAMES_PER_CANDIDATE = 3
FRAME_WIDTH = 512
MAX_SHIFT = 12.0          # seconds Gemini may move a cut point
MAX_CORRECTIONS = 30


def model_name():
    # Creative writing is where flash-lite visibly falls short (see
    # thumbnail.py), so the editor uses the stronger model by default.
    return (os.environ.get("GEMINI_MODEL_GAMING") or os.environ.get("GEMINI_MODEL_THUMBNAIL")
            or "gemini-3.7-flash")


class Pick(BaseModel):
    id: int = Field(description="id do candidato")
    keep: bool = Field(description="true se vale virar um Short")
    score: int = Field(description="0 a 100: chance de prender quem assiste")
    start: float = Field(description="início do corte em segundos (pode ajustar até 12 s)")
    end: float = Field(description="fim do corte em segundos (pode ajustar até 12 s)")
    moment_category: str
    title: str = Field(description="título do Short em PT-BR, até 60 caracteres")
    description: str = Field(description="descrição em PT-BR, 1 a 2 frases")
    hashtags: List[str] = Field(description="5 a 8 hashtags")
    hook: str = Field(description="gancho na tela, 1 a 3 palavras em MAIÚSCULAS")
    reason: str = Field(description="por que este momento é bom (curto)")


class Correction(BaseModel):
    wrong: str = Field(description="palavra errada exatamente como está na fala transcrita")
    right: str = Field(description="palavra correta")


class Verdict(BaseModel):
    picks: List[Pick]
    corrections: List[Correction] = Field(default_factory=list)


PROMPT = """Você é um editor profissional de Shorts, Reels e TikTok de gameplay, especialista no público brasileiro.

Jogo: {game} (categoria: {category}).
Duração alvo de cada corte: {clip_seconds:.0f} segundos. Quero no máximo {max_clips} cortes.

Abaixo estão {n} momentos candidatos, encontrados por sinais de áudio, imagem e fala. Para cada um você recebe
o intervalo, as evidências medidas, o que o jogador falou e 3 quadros do vídeo (início, pico e fim).

Para CADA candidato, decida:
- keep: só true se o momento prende a atenção nos 3 primeiros segundos e faz sentido sozinho
  (eliminação, jogada, susto, reação engraçada, vitória, clutch...). Momentos parados, menus,
  loading, conversa sem ação: keep false.
- score: 0 a 100.
- start/end: ajuste para começar logo antes da ação e terminar logo depois da reação, sem cortar fala no meio.
  Pode mover cada ponto no máximo 12 s em relação ao candidato. Mantenha perto da duração alvo.
- moment_category: uma destas: {moments}.
- title: o título do Short. Regras:
  * português do Brasil, linguagem de quem joga (gírias do jogo são bem-vindas), 25 a 55 caracteres;
  * conte o que ACONTECE neste corte específico, usando o que você vê nos quadros e o que o jogador fala
    (de preferência a melhor frase dele, entre aspas ou adaptada);
  * a parte que dá vontade de assistir vem primeiro (o celular corta títulos longos);
  * verdadeiro: não prometa o que o corte não mostra;
  * no máximo 1 emoji, no fim; sem hashtags; no máximo 1 palavra em MAIÚSCULAS;
  * cada título diferente dos outros (não repita a mesma estrutura nem a mesma frase);
  * não repita o texto do hook;
  * evite títulos genéricos como "Gameplay de X", "Momento incrível no X", "Mais um trecho".
  Bons exemplos: "Sobrou só eu… e virei a partida 🔥", "\"Ele tava atrás de mim!\" 😱",
  "Capa no último tiro, que reflexo 🎯", "Pulei na pior hora e deu certo".
- description: 1 a 2 frases em PT-BR.
- hashtags: 5 a 8, começando com #, inclua o jogo.
- hook: 1 a 3 palavras em MAIÚSCULAS para aparecer na tela (ex.: "QUE CLUTCH!").
- reason: frase curta explicando a escolha.

Também devolva corrections: palavras que a transcrição claramente errou (nomes do jogo, armas, mapas,
gírias), só palavra única por palavra única. No máximo 30. Se não houver, lista vazia.

Candidatos (JSON):
{candidates}
"""


def _ts(sec):
    sec = max(0, int(sec))
    return f"{sec // 60:02d}:{sec % 60:02d}"


def _words_between(transcript, start, end):
    out = []
    for seg in (transcript or {}).get("segments") or []:
        for w in seg.get("words") or []:
            if w.get("end", 0) >= start and w.get("start", 0) <= end:
                out.append(str(w.get("word", "")).strip())
    text = " ".join(x for x in out if x)
    return text[:700]


def _frames(video_path, times):
    """JPEG bytes for each time (None where a frame cannot be read)."""
    import cv2
    cap = cv2.VideoCapture(video_path)
    out = []
    try:
        for t in times:
            cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, float(t)) * 1000.0)
            ok, frame = cap.read()
            if not ok or frame is None:
                out.append(None)
                continue
            h, w = frame.shape[:2]
            if w > FRAME_WIDTH:
                frame = cv2.resize(frame, (FRAME_WIDTH, int(h * FRAME_WIDTH / w)), interpolation=cv2.INTER_AREA)
            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 72])
            out.append(buf.tobytes() if ok else None)
    finally:
        cap.release()
    return out


def pool_size(settings):
    """Candidates the AI sees: 12 by default, more when more cuts are asked
    (2 spare per cut). Cost grows with the requested count, not the video."""
    want = int((settings or {}).get("max_clips") or 8)
    return max(MAX_CANDIDATES, min(MAX_POOL, want + 2 * max(1, want // 5)))


def top_up(picked, pool, max_clips):
    """Fill the AI's picks up to max_clips with the best remaining pool clips
    that do not overlap (used when the panel asks for an exact count)."""
    out = list(picked)
    for c in sorted(pool, key=lambda x: -float(x.get("relevance_score") or 0)):
        if len(out) >= max_clips:
            break
        if any(min(c["end"], o["end"]) - max(c["start"], o["start"]) > 0 for o in out):
            continue
        extra = dict(c)
        extra["evidence"] = ["Trecho para completar a quantidade pedida"] + [
            e for e in (c.get("evidence") or []) if "completar" not in e]
        extra["filler"] = True
        extra["moment_label"] = "Trecho extra"
        out.append(extra)
    out.sort(key=lambda c: c["start"])
    return out


def build_candidates(pool, transcript, limit=MAX_CANDIDATES):
    cands = []
    for i, c in enumerate(pool[:limit]):
        start, end = float(c["start"]), float(c["end"])
        peak = float(c.get("peak_time") or (start + end) / 2)
        cands.append({
            "id": i, "start": round(start, 2), "end": round(end, 2), "peak": round(peak, 2),
            "intervalo": f"{_ts(start)}–{_ts(end)}",
            "categoria_sugerida": c.get("moment_category"),
            "nota_local": c.get("relevance_score"),
            "evidencias": c.get("evidence") or [],
            "fala": _words_between(transcript, start, end),
            "_frame_times": [start + (end - start) * 0.15, peak, start + (end - start) * 0.85],
        })
    return cands


def _clean_tags(tags, game_name):
    out = []
    for t in tags or []:
        t = re.sub(r"[^\w]", "", str(t).lstrip("#"), flags=re.UNICODE)[:30]
        if t and ("#" + t.lower()) not in out:
            out.append("#" + t.lower())
    game_tag = "#" + re.sub(r"[^\w]", "", (game_name or "").lower(), flags=re.UNICODE)
    if len(game_tag) > 1 and game_tag not in out:
        out.insert(0, game_tag)
    return out[:8]


def apply_verdict(verdict, cands, pool, game, settings, duration):
    """Validated clips from Gemini's answer (pure function: unit-tested)."""
    used_titles = set()
    clip_len = float(settings.get("clip_seconds") or 30)
    max_clips = int(settings.get("max_clips") or 8)
    min_score = float(settings.get("min_score") if settings.get("min_score") is not None else 30)
    by_id = {c["id"]: c for c in cands}
    out = []
    for p in sorted(verdict.get("picks") or [], key=lambda x: -int(x.get("score") or 0)):
        cand = by_id.get(p.get("id"))
        if cand is None or not p.get("keep") or int(p.get("score") or 0) < min_score:
            continue
        base = dict(pool[cand["id"]])
        start = float(p.get("start", cand["start"]))
        end = float(p.get("end", cand["end"]))
        # Keep Gemini's cut only when it stays near the candidate and the target length.
        length = end - start
        if (abs(start - cand["start"]) > MAX_SHIFT or abs(end - cand["end"]) > MAX_SHIFT
                or not (0.6 * clip_len <= length <= 1.4 * clip_len) or start < 0 or end > duration + 0.5):
            start, end = cand["start"], cand["end"]
        if any(min(end, o["end"]) - max(start, o["start"]) > 0.5 * (end - start) for o in out):
            continue                                   # overlaps a better clip
        cat = p.get("moment_category")
        if cat not in profiles.MOMENTS:
            cat = base.get("moment_category") or "jogada"
        title = clean_title(p.get("title"), used_titles) or base.get("video_title_for_youtube_short", "")
        used_titles.add(title.lower())
        desc = str(p.get("description") or "").strip() or base.get("description", "")
        tags = _clean_tags(p.get("hashtags"), game.get("name"))
        tag_line = " ".join(tags)
        hook = re.sub(r"\s+", " ", str(p.get("hook") or "").strip().upper())[:28] or base.get("viral_hook_text")
        reason = str(p.get("reason") or "").strip()[:160]
        base.update({
            "start": round(start, 2), "end": round(end, 2),
            "relevance_score": int(p.get("score")), "predicted_score": int(p.get("score")),
            "moment_category": cat, "moment_label": profiles.MOMENTS[cat]["label"],
            "video_title_for_youtube_short": title, "description": desc, "hashtags": tags,
            "video_description_for_tiktok": f"{desc} {tag_line}".strip(),
            "video_description_for_instagram": f"{desc}\n\n{tag_line}".strip(),
            "viral_hook_text": hook, "thumbnail_text": hook,
            "evidence": ([f"IA: {reason}"] if reason else []) + list(base.get("evidence") or []),
            "analysis_engine": "gemini",
        })
        out.append(base)
        if len(out) >= max_clips:
            break
    out.sort(key=lambda c: c["start"])
    return out


_EMOJI_RE = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF]")


def clean_title(raw, used=()):
    """Gemini's title made safe for every network: no hashtags or wrapping
    quotes, at most one emoji (at the end), not shouted in full caps, at most
    70 characters, and not a repeat of another clip's title (then None, so
    the local title is kept)."""
    t = re.sub(r"#\w+", "", str(raw or "")).strip()
    t = re.sub(r"\s+", " ", t).strip(" -|")
    if len(t) >= 2 and t[0] == t[-1] and t[0] in "\"'“”":
        t = t[1:-1].strip()
    emojis = _EMOJI_RE.findall(t)
    if len(emojis) > 1:
        t = _EMOJI_RE.sub("", t).strip() + " " + emojis[-1]
    letters = [c for c in t if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.7 and len(t.split()) > 2:
        t = t[0] + t[1:].lower()
    if len(t) > 70:
        t = t[:69].rsplit(" ", 1)[0].rstrip(",;:-") + "…"
    if not t or t.lower() in used:
        return None
    return t


def apply_corrections(transcript, corrections):
    """Replace single misheard words in place; timings are untouched."""
    fixes = {}
    for c in (corrections or [])[:MAX_CORRECTIONS]:
        wrong, right = str(c.get("wrong", "")).strip(), str(c.get("right", "")).strip()
        if wrong and right and " " not in wrong and " " not in right and wrong.lower() != right.lower():
            fixes[wrong.lower()] = right
    if not fixes or not transcript:
        return 0
    n = 0
    for seg in transcript.get("segments") or []:
        for w in seg.get("words") or []:
            raw = str(w.get("word", ""))
            m = re.match(r"^(\s*)([^\w]*)([\w'-]+)([^\w]*)$", raw, flags=re.UNICODE)
            if m and m.group(3).lower() in fixes:
                w["word"] = m.group(1) + m.group(2) + fixes[m.group(3).lower()] + m.group(4)
                n += 1
        if n:
            seg["text"] = "".join(str(w.get("word", "")) for w in seg.get("words") or []) or seg.get("text", "")
    return n


def judge(video_path, transcript, duration, game, settings, pool, api_key=None, client=None, log=print):
    """-> list of clips, or None to keep the local result."""
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not pool or (client is None and not api_key):
        return None
    try:
        from google.genai import types
        if client is None:
            from google import genai
            client = genai.Client(api_key=api_key)
        cands = build_candidates(pool, transcript, pool_size(settings))
        cat = profiles.category(game.get("category") or "other")
        prompt = PROMPT.format(
            game=game.get("name") or "Gameplay", category=cat["label"],
            clip_seconds=float(settings.get("clip_seconds") or 30), max_clips=int(settings.get("max_clips") or 8),
            n=len(cands), moments=", ".join(profiles.MOMENTS),
            candidates=json.dumps([{k: v for k, v in c.items() if not k.startswith("_")} for c in cands],
                                  ensure_ascii=False))
        parts = [types.Part.from_text(text=prompt)]
        for c in cands:
            for k, jpg in enumerate(_frames(video_path, c["_frame_times"])):
                if jpg:
                    parts.append(types.Part.from_text(text=f"Candidato {c['id']} · quadro {k + 1} "
                                                           f"({_ts(c['_frame_times'][k])})"))
                    parts.append(types.Part.from_bytes(data=jpg, mime_type="image/jpeg"))
        log(f"🧠 IA profissional (Gemini {model_name()}) avaliando {len(cands)} momento(s) candidatos...")
        resp = client.models.generate_content(
            model=model_name(), contents=[types.Content(role="user", parts=parts)],
            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Verdict,
                                               temperature=0.4))
        parsed = getattr(resp, "parsed", None)
        if parsed is not None:
            verdict = parsed.model_dump() if hasattr(parsed, "model_dump") else dict(parsed)
        else:
            verdict = json.loads(resp.text)
        clips = apply_verdict(verdict, cands, pool, game, settings, duration)
        fixed = apply_corrections(transcript, verdict.get("corrections"))
        if fixed:
            log(f"🧠 IA corrigiu {fixed} palavra(s) da transcrição (legendas mais precisas).")
        if not clips:
            log("🧠 IA não aprovou nenhum candidato — mantendo a seleção do motor local.")
            return None
        log(f"🧠 IA escolheu {len(clips)} corte(s) e escreveu títulos, descrições e ganchos.")
        return clips
    except Exception as e:  # noqa: BLE001 - any failure keeps the local result
        log(f"⚠️ IA profissional indisponível ({explain_error(e)}) — usando o motor local.")
        return None


def explain_error(e):
    msg = str(e)
    if "API key not valid" in msg or "API_KEY_INVALID" in msg:
        return "chave do Gemini inválida; confira em Configurações"
    if "RESOURCE_EXHAUSTED" in msg or " 429" in msg:
        return "cota do Gemini esgotada por agora; tente mais tarde"
    if "PERMISSION_DENIED" in msg:
        return "a chave do Gemini não tem permissão para este modelo"
    if "NOT_FOUND" in msg and "model" in msg.lower():
        return "modelo do Gemini não encontrado; ajuste GEMINI_MODEL_GAMING"
    return f"{type(e).__name__}: {msg[:120]}"
