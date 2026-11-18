"""Time left for a job, per stage, and the clips as they are being built.

Measured on this project (CPU, 4 cores, 3-min gameplay, 5 clips of 15 s):
analysis ~30 s, then clips render 3 at a time: the first one is exported
~85 s after rendering starts, the next ones every ~42 s. The old progress bar
said 59% at 30 s of a 286 s job, so time left is estimated per stage here, from
the job's own timestamps, and every finished job refines the rates for this
machine (output/gaming/tempos.json).

Everything that parses or estimates is a pure function (unit-tested); the
files on disk only feed construcao().
"""
import json
import os
import re
import statistics
import subprocess
import threading

# Starting rates (seconds), replaced by this machine's measurements after the
# first jobs: fixed analysis cost, analysis per minute of source, first clip
# per second of clip, each further clip per second of clip.
PADRAO = {"fixo": 8.0, "por_minuto": 7.5, "primeiro_por_seg": 5.7, "seguinte_por_seg": 2.8}
HISTORICO_MAX = 10

_RE_DUR = re.compile(r"(?:(\d+)h)?(\d+)min(\d+)s")
_RE_JANELA = re.compile(r"janelas de (\d+(?:\.\d+)?)s")
_RE_CORTE = re.compile(r"Corte (\d+): recortando (\d+(?:\.\d+)?)s → (\d+(?:\.\d+)?)s")
_RE_EXPORT = re.compile(r"Corte (\d+) exportado")
_RE_SELEC = re.compile(r"(\d+) corte\(s\) selecionado")


def _dur(text):
    m = _RE_DUR.search(text or "")
    if not m:
        return None
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s


def ler_console(console):
    """Facts the console already states, with their timestamps."""
    out = {"inicio": None, "fonte_s": None, "clip_s": None, "render_inicio": None,
           "cortes": {}, "exportados": {}, "selecionados": None}
    for c in console or []:
        t, txt = c.get("t"), str(c.get("text") or "")
        if t is not None and out["inicio"] is None:
            out["inicio"] = t
        if c.get("agent") == "ingest" and out["fonte_s"] is None:
            out["fonte_s"] = _dur(txt)
        m = _RE_JANELA.search(txt)
        if m:
            out["clip_s"] = float(m.group(1))
        m = _RE_SELEC.search(txt)
        if m:
            out["selecionados"] = int(m.group(1))
        m = _RE_CORTE.search(txt)
        if m:
            i = int(m.group(1))
            out["cortes"][i] = (float(m.group(2)), float(m.group(3)))
            if out["render_inicio"] is None and t is not None:
                out["render_inicio"] = t
        m = _RE_EXPORT.search(txt)
        if m and t is not None:
            out["exportados"][int(m.group(1))] = t
    return out


def medir(console):
    """Rates measured from a finished job (or None when it says too little)."""
    f = ler_console(console)
    exp = sorted(f["exportados"].values())
    if f["inicio"] is None or f["render_inicio"] is None or not (f["fonte_s"] and f["clip_s"] and exp):
        return None
    analise = f["render_inicio"] - f["inicio"]
    r = {"por_minuto": max(0.0, analise - PADRAO["fixo"]) / (f["fonte_s"] / 60.0),
         "primeiro_por_seg": (exp[0] - f["render_inicio"]) / f["clip_s"]}
    if len(exp) > 1:
        r["seguinte_por_seg"] = (exp[-1] - exp[0]) / (len(exp) - 1) / f["clip_s"]
    return r


def taxas(historico):
    """Median of this machine's measurements, defaults where there are none."""
    out = dict(PADRAO)
    for k in ("por_minuto", "primeiro_por_seg", "seguinte_por_seg"):
        vals = [h[k] for h in historico or [] if isinstance(h.get(k), (int, float)) and h[k] > 0]
        if vals:
            out[k] = statistics.median(vals)
    return out


def estimar(agora, status, snap, console, settings, rates):
    """Seconds left overall and per stage. snap is pipeline.snapshot()."""
    f = ler_console(console)
    ativo = status in ("queued", "processing")
    clips = snap.get("clips") or {}
    clip_s = f["clip_s"] or float((settings or {}).get("clip_seconds") or 30)
    pedidos = int((settings or {}).get("max_clips") or 8)
    n = clips.get("total") or f["selecionados"] or pedidos
    prontos = int(clips.get("ready") or 0)
    inicio = agora if f["inicio"] is None else f["inicio"]
    decorrido = max(0.0, agora - inicio)
    primeiro = rates["primeiro_por_seg"] * clip_s
    seguinte = rates["seguinte_por_seg"] * clip_s

    if not ativo:
        return {"restante_s": 0, "decorrido_s": round(decorrido), "progresso": 100 if status == "completed" else None,
                "etapas": [], "taxas": rates}

    # 1. Analysis (validation, game, transcription, moments).
    if f["render_inicio"] is None:
        total_analise = rates["fixo"] + rates["por_minuto"] * ((f["fonte_s"] or 180) / 60.0)
        resto_analise = max(3.0, total_analise - decorrido)
        wp = snap.get("whisper_pct")
        if wp and 0 < wp < 100 and "whisper" in (snap.get("working") or []):
            # Whisper reports its own percentage: trust it for its share.
            resto_analise = max(resto_analise * 0.5, decorrido * (100 - wp) / wp * 0.6)
        render_inicio = agora + resto_analise
    else:
        resto_analise = 0.0
        render_inicio = f["render_inicio"]

    # 2. Rendering: clips 3 at a time; first export, then a steady pace.
    exp = sorted(f["exportados"].values())
    previsto = primeiro + max(0, n - 1) * seguinte          # render time on this machine's pace
    if not exp:
        fim = render_inicio + previsto
    else:
        # Clips render in parallel, so the k-th export is compared with when the
        # model expected it; this job's speed ratio scales what is left.
        razoes = [(t - render_inicio) / (primeiro + k * seguinte) for k, t in enumerate(exp)
                  if primeiro + k * seguinte > 0]
        # Exports come in bunches (3 clips at a time), so one late export says
        # little: trust this job's ratio only as much as the share already done.
        peso = min(1.0, prontos / max(1, n))
        razao = 1.0 + ((statistics.mean(razoes) if razoes else 1.0) - 1.0) * peso
        fim = max(exp[-1] + (2.0 if prontos < n else 0.0), render_inicio + razao * previsto)
    restante = max(0.0 if prontos >= n else 3.0, fim - agora)

    def etapa(id_, label, resto, feito, comecou):
        return {"id": id_, "label": label, "restante_s": round(max(0.0, resto)),
                "estado": "concluido" if feito else ("andamento" if comecou else "aguardando")}

    render_comecou = f["render_inicio"] is not None
    # From the measurements: the last reframe ends ~1.7 s per clip-second before
    # the end; captions and export are the last seconds.
    cauda = 1.7 * clip_s
    etapas = [
        etapa("analise", "Análise do vídeo", resto_analise, render_comecou, True),
        etapa("edicao", "Edição 9:16", restante - cauda, int(clips.get("reframed") or 0) >= n, render_comecou),
        etapa("legendas", "Gancho e legendas", restante - 3, prontos >= n, int(clips.get("reframed") or 0) > 0),
        etapa("exportacao", "Exportação", restante, prontos >= n, prontos > 0),
    ]
    total = decorrido + restante
    return {"restante_s": round(restante), "decorrido_s": round(decorrido),
            "progresso": int(min(99, max(1, round(100 * decorrido / total)))) if total > 0 else 1,
            "etapas": etapas, "cortes": n, "prontos": prontos}


# --------------------------------------------------------------------------- #
# This machine's measured rates
# --------------------------------------------------------------------------- #
_LOCK = threading.Lock()


def _arquivo(output_dir):
    return os.path.join(output_dir, "gaming", "tempos.json")


def carregar(output_dir):
    try:
        with open(_arquivo(output_dir), encoding="utf-8") as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def registrar(output_dir, job_id, console):
    """Store the rates of a finished job once (keeps the last HISTORICO_MAX)."""
    r = medir(console)
    if not r:
        return False
    with _LOCK:
        d = carregar(output_dir)
        hist = [h for h in d.get("historico", []) if h.get("job") != job_id]
        if len(hist) != len(d.get("historico", [])):
            return False                       # already recorded
        hist.append({"job": job_id, **{k: round(v, 3) for k, v in r.items()}})
        d["historico"] = hist[-HISTORICO_MAX:]
        os.makedirs(os.path.dirname(_arquivo(output_dir)), exist_ok=True)
        tmp = _arquivo(output_dir) + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(d, f, indent=1)
        os.replace(tmp, _arquivo(output_dir))
    return True


# --------------------------------------------------------------------------- #
# Clips being built: the real intermediate files of each clip
# --------------------------------------------------------------------------- #
_VALIDOS = {}


def _video_ok(path):
    """A finished MP4 (moov present). Partial files being written fail ffprobe."""
    try:
        st = os.stat(path)
    except OSError:
        return False
    chave = (path, st.st_size, st.st_mtime)
    if chave in _VALIDOS:
        return _VALIDOS[chave]
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                           capture_output=True, text=True, timeout=10)
        ok = r.returncode == 0 and float((r.stdout or "0").strip() or 0) > 0
    except (OSError, ValueError, subprocess.TimeoutExpired):
        ok = False
    if len(_VALIDOS) > 2000:
        _VALIDOS.clear()
    _VALIDOS[chave] = ok
    return ok


ESTAGIOS = ["aguardando", "enquadrando", "gancho", "legendas", "pronto"]


def construcao(job_dir, job_id, console, prontos_idx=()):
    """Per clip: the furthest stage it reached and the newest playable file."""
    f = ler_console(console)
    try:
        nomes = os.listdir(job_dir)
    except OSError:
        nomes = []
    out = []
    for i in sorted(f["cortes"]):
        fim = f"_clip_{i}.mp4"
        base = [n for n in nomes if n.endswith(fim) and n.startswith(job_id)]
        hooked = [n for n in nomes if n.endswith(fim) and n.startswith("hooked_")]
        subs = [n for n in nomes if n.endswith(fim) and n.startswith("subtitled_")]
        estagio, video = "enquadrando", None
        for nome, depois in ((base, "gancho"), (hooked, "legendas"), (subs, "pronto")):
            okes = [n for n in nome if _video_ok(os.path.join(job_dir, n))]
            if okes:
                estagio, video = depois, sorted(okes)[-1]
        if i in f["exportados"] or i in set(prontos_idx):
            estagio = "pronto"
        s, e = f["cortes"][i]
        out.append({"indice": i, "inicio": s, "fim": e, "estagio": estagio,
                    "video_url": f"/videos/{job_id}/{video}" if video else None})
    return out
