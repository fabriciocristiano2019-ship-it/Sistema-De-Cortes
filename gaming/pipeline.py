"""Sede Virtual: turns a job's real log into the state of each "agent".

The eight agents of the Gaming Edition panel are the real stages of the
pipeline, nothing more. This module never invents progress: every state is
derived from lines the pipeline actually printed (plus the job status), so an
agent only shows "trabalhando" while its stage is running and "concluído" once
the lines that end it have appeared.

Pure functions, no I/O apart from ``probe_summary``/``self_test`` helpers, so
the mapping is unit-tested against captured logs (tests/test_gaming_pipeline.py).
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import time

class TimedLogs(list):
    """A job's log lines plus the wall-clock time each one arrived.

    A plain list everywhere else in the app (it serialises as one); the panel's
    console reads ``times`` to stamp lines with when they really happened.
    """

    def __init__(self, items=()):
        super().__init__(items)
        now = time.time()
        self.times = [now] * len(self)

    def append(self, item):
        super().append(item)
        self.times.append(time.time())


# Agent codenames are Marvel AIs (the orchestrator is J.A.R.V.I.S.): labels only.
# Execution order of the real pipeline. ``module`` is the panel module a click
# on the agent's room opens.
AGENTS = [
    {"id": "ingest", "name": "Importação & Validação", "role": "F.R.I.D.A.Y. · Ingestão", "module": "import",
     "does": "Recebe o arquivo ou link, valida com FFprobe e preserva o original."},
    {"id": "library", "name": "Reconhecimento", "role": "GRIOT · Jogo automático", "module": "import",
     "does": "Reconhece o jogo sozinho (nome do arquivo e fala) para o título e as hashtags."},
    {"id": "whisper", "name": "Transcrição Whisper", "role": "K.A.R.E.N. · Faster-Whisper", "module": "subtitles",
     "does": "Transcreve a fala localmente, com tempo de cada palavra."},
    {"id": "vision", "name": "Análise Áudio & Visual", "role": "E.D.I.T.H. · Detector", "module": "analysis",
     "does": "Mede picos de áudio, movimento, cortes de cena e palavras-chave."},
    {"id": "slicer", "name": "Motor de Cortes", "role": "ULTRON · Contexto", "module": "clips",
     "does": "Escolhe as janelas com evidência, ajusta às pausas e pontua a relevância."},
    {"id": "editor916", "name": "Editor 9:16 & HUD", "role": "VISION · FFmpeg", "module": "editor",
     "does": "Recorta e renderiza em 1080x1920 (H.264 + AAC) no layout escolhido."},
    {"id": "captions", "name": "Legendas Animadas", "role": "JOCASTA · Tipografia", "module": "subtitles",
     "does": "Queima as legendas palavra por palavra e o gancho inicial."},
    {"id": "social", "name": "Central Social & Exportação", "role": "VERONICA · Publicador", "module": "social",
     "does": "Entrega o MP4 com título, descrição e hashtags para aprovação manual."},
]
AGENT_IDS = [a["id"] for a in AGENTS]
_BY_ID = {a["id"]: a for a in AGENTS}

_STRATEGY_PT = {
    "WIDE": "A · tela inteira, HUD preservado",
    "INSET": "B · gameplay com webcam",
    "TRACK": "C · vertical adaptado",
    "GENERAL": "fundo desfocado",
}

# (agent, regex, PT-BR text | callable(match) | None to keep the original line, level)
# First match wins. ``\g<name>`` groups are substituted into the text.
_YT_BOT = ("O YouTube bloqueou o download neste servidor (pede login para provar que não é robô). "
           "Cole os cookies da sua conta em Módulos → 12. Chaves e Integrações → Cookies do YouTube "
           "e tente de novo, ou envie o arquivo do vídeo em vez do link.")

_RULES = [
    # Download failures first: the yt-dlp error line also matches the generic rules below.
    ("ingest", r"confirm you.?re not a bot|Sign in to confirm", _YT_BOT, "error"),
    ("ingest", r"Private video|Video unavailable|This video is unavailable|members-only",
     "O vídeo do link é privado, exclusivo para membros ou não está disponível.", "error"),
    ("ingest", r"Unsupported URL", "Este link não é de um vídeo que o sistema consiga baixar.", "error"),
    ("ingest", r"Could not resolve host|Name or service not known|getaddrinfo failed|Failed to resolve",
     "Não foi possível acessar o site do link (endereço errado ou servidor sem acesso a esse site).", "error"),
    ("ingest", r"UnsafeURLError", "Este link aponta para um endereço que o sistema não permite acessar.", "error"),
    ("ingest", r"(?i)HTTP Error 429|Too Many Requests",
     "O site do vídeo limitou os downloads deste servidor. Tente mais tarde ou envie o arquivo.", "error"),
    # Python traceback noise: kept in the full log, not in the agents' diary.
    ("core", r'^\s*(Traceback \(most recent call last\)|File "|raise |return |\^+\s*$|~+[\s^~]*$|_format_err|self\.\w+\()',
     None, "raw"),
    ("ingest", r"Arquivo validado", None, "ok"),
    ("ingest", r"Downloading video from YouTube", "Baixando o vídeo do link informado…", "info"),
    ("ingest", r"Direct file URL", "Baixando o arquivo do link direto…", "info"),
    ("ingest", r"Download attempt: (?P<a>.+)", r"Tentativa de download (\g<a>)…", "info"),
    ("ingest", r"Download succeeded", "Download concluído.", "ok"),
    ("ingest", r"Download attempt '.*' failed: (?P<a>.+)", r"Tentativa de download falhou: \g<a>", "warn"),
    ("ingest", r"Video downloaded in (?P<a>[\d.]+)s", r"Vídeo baixado em \g<a> s.", "ok"),
    ("library", r"Jogo (identificado|não identificado|selecionado|ainda não identificado)", None, "ok"),
    ("whisper", r"Transcribing video", "Transcrevendo a fala localmente (Faster-Whisper)…", "info"),
    ("whisper", r"Transcribing… (?P<a>\d+)%", None, "progress"),
    ("whisper", r"Reusing (?:precomputed|the) transcript.*?\((?P<a>\d+) segments\)",
     r"Transcrição já existente reaproveitada (\g<a> segmentos).", "ok"),
    ("whisper", r"Detected language '(?P<a>[\w-]+)'.*?probability (?P<b>[\d.]+)",
     r"Idioma detectado: \g<a> (confiança \g<b>).", "ok"),
    ("whisper", r"Detected language '(?P<a>[\w-]+)'", r"Idioma detectado: \g<a>.", "ok"),
    ("whisper", r"^\s*\[\d+\.\d+s -> \d+\.\d+s\]", None, "segment"),
    ("vision", r"switching to visual analysis", "Pouca ou nenhuma fala: a análise segue pelo áudio e pela imagem.", "warn"),
    ("vision", r"Motor local de momentos", None, "info"),
    ("vision", r"Análise de áudio|Análise visual", None, "info"),
    ("vision", r"Analyzing with Gemini|Gemini vision|^\S*\s*Model: ", None, "info"),
    ("vision", r"Motor Gemini escolhido sem|Gemini falhou", None, "warn"),
    ("slicer", r"Selecionando janelas", None, "info"),
    ("slicer", r"momento\(s\) com evidência", None, "ok"),
    ("slicer", r"Found (?P<a>\d+) clips", r"\g<a> corte(s) selecionado(s) para renderização.", "ok"),
    ("slicer", r"Saved metadata", "Roteiro dos cortes salvo (títulos, descrições e hashtags).", "info"),
    ("editor916", r"Processing Clip (?P<a>\d+): (?P<b>[\d.]+)s - (?P<c>[\d.]+)s",
     r"Corte \g<a>: recortando \g<b>s → \g<c>s e enquadrando em 9:16…", "info"),
    ("editor916", r"Reframe v2 total: (?P<a>[\d.]+)s", r"Enquadramento 1080x1920 concluído em \g<a> s.", "ok"),
    ("editor916", r"Reframe v2 failed", None, "warn"),
    ("editor916", r"video encoder: (?P<a>\S+)", r"Codificador de vídeo: \g<a>.", "info"),
    ("editor916", r"Framing override: every scene -> (?P<a>\w+)",
     lambda m: f"Layout aplicado em todas as cenas: {_STRATEGY_PT.get(m.group('a'), m.group('a'))}.", "info"),
    ("editor916", r"Punch-in on (?P<a>\d+) beat", r"Zoom dinâmico em \g<a> pico(s) do corte.", "info"),
    ("editor916", r"Scene engine|Reframe engine v2", None, "detail"),
    ("editor916", r"Processing clip:|Passthrough|Step \d|Found \d+ scenes|No scenes were detected|"
                  r"Frame loop|Clip saved to|Title:", None, "detail"),
    ("captions", r"Captions burned", "Legendas palavra por palavra aplicadas.", "ok"),
    ("captions", r"Hook burned \((?P<a>[^)]*)\): (?P<b>.+)", r"Gancho inicial aplicado: “\g<b>”.", "ok"),
    ("captions", r"No words in range", "Sem fala neste trecho: corte entregue sem legenda.", "warn"),
    ("captions", r"Auto-captions failed|Auto-hook failed", None, "warn"),
    ("captions", r"Overlaying hook|Hook added to|Burning subtitles", None, "detail"),
    ("social", r"Clip (?P<a>\d+) ready", r"Corte \g<a> exportado em MP4, aguardando aprovação manual.", "ok"),
    ("vision", r"propondo candidatos para a IA", "Motor local encontrou os candidatos; a IA profissional vai avaliar.", "info"),
    ("slicer", r"IA profissional \(Gemini (?P<a>[^)]+)\) avaliando (?P<b>\d+)",
     r"IA profissional (Gemini) assistindo \g<b> momento(s) candidatos…", "info"),
    ("slicer", r"IA escolheu (?P<a>\d+) corte", r"IA escolheu \g<a> corte(s) e escreveu títulos, descrições e ganchos.", "ok"),
    ("captions", r"IA corrigiu (?P<a>\d+) palavra", r"IA corrigiu \g<a> palavra(s) da transcrição.", "ok"),
    ("slicer", r"IA não aprovou nenhum candidato|IA profissional indisponível", None, "warn"),
    ("editor916", r"Enquadramento automático", None, "info"),
    ("core", r"Job .* queued", "Gameplay recebida. Aguardando vaga na fila local…", "info"),
    ("core", r"Job started by worker", "J.A.R.V.I.S. recebeu a gameplay. Delegando aos agentes…", "info"),
    ("core", r"Process finished successfully", "Processamento finalizado. Cortes prontos para revisão.", "ok"),
    ("core", r"Cancelamento solicitado|Processamento cancelado", None, "warn"),
    ("core", r"Process failed with exit code (?P<a>\d+)",
     r"O processamento parou com erro (código \g<a>). O motivo está na mensagem acima.", "error"),
    ("core", r"Execution error|No metadata file generated", None, "error"),
    ("core", r"Job recovered from disk", "Trabalho recuperado do disco após reinício do servidor.", "info"),
    ("core", r"Nenhum momento com evidência", None, "error"),
]
_COMPILED = [(a, re.compile(rx), txt, lvl) for a, rx, txt, lvl in _RULES]

_EMOJI = re.compile(r"^[\s\W_]+", re.UNICODE)


def _clean(line):
    """Drop leading emoji/indent; the console tags lines by agent instead."""
    return _EMOJI.sub("", str(line)).strip() or str(line).strip()


def classify(line):
    """-> (agent_id | 'core' | None, text, level)."""
    s = str(line)
    for agent, rx, txt, lvl in _COMPILED:
        m = rx.search(s)
        if m:
            if callable(txt):
                return agent, txt(m), lvl
            return agent, (m.expand(txt) if txt else _clean(s)), lvl
    low = s.lower()
    if "error" in low or "traceback" in low or s.lstrip().startswith("❌"):
        return None, _clean(s), "error"
    return None, _clean(s), "raw"


def _count(logs, pattern):
    rx = re.compile(pattern)
    return sum(1 for ln in logs if rx.search(str(ln)))


def snapshot(logs, status, times=None, clips_ready=None):
    """State of every agent for one job.

    status: queued | processing | completed | failed | cancelled
    Returns agents (state: idle|waiting|working|done|skipped|failed), the
    current step, an honest progress percentage and the tagged console lines.
    """
    logs = list(logs or [])
    seen = {a: False for a in AGENT_IDS}
    last_agent = None
    console = []
    segments = 0
    whisper_pct = None
    for i, ln in enumerate(logs):
        agent, text, level = classify(ln)
        t = times[i] if times and i < len(times) else None
        if agent in seen:
            seen[agent] = True
            last_agent = agent
        if level == "segment":           # one line per transcript segment: count, don't flood
            segments += 1
            continue
        if level == "progress":          # whisper percentage: drives the bar, not the console
            mm = re.search(r"(\d+)%", str(ln))
            if mm:
                whisper_pct = int(mm.group(1))
            continue
        if level in ("detail", "raw"):   # kept for the full log view, not the console
            continue
        if console and console[-1]["agent"] == agent and console[-1]["text"] == text:
            continue                     # same message repeated (e.g. one per download attempt)
        console.append({"t": t, "agent": agent, "level": level, "text": text})
    if segments:
        # Place the running total right after the last whisper line.
        idx = max((i for i, c in enumerate(console) if c["agent"] == "whisper"), default=len(console) - 1)
        console.insert(idx + 1, {"t": console[idx]["t"] if console else None, "agent": "whisper",
                                 "level": "info", "text": f"{segments} trecho(s) de fala transcrito(s)."})

    m = None
    for ln in logs:
        mm = re.search(r"Found (\d+) clips", str(ln))
        if mm:
            m = int(mm.group(1))
    total = m
    started = _count(logs, r"Processing Clip \d+:")
    reframed = _count(logs, r"Reframe v2 total|Reframe v2 failed|Merging\.\.\.")
    ready = _count(logs, r"Clip \d+ ready")
    if clips_ready is not None:
        ready = max(ready, int(clips_ready))
    reframed = max(reframed, ready)
    started = max(started, reframed)

    active = status in ("queued", "processing")
    finished = status == "completed"
    if finished and not any(seen.values()):
        # A job read back from disk after a restart: its log is gone, but it
        # completed, so every stage ran. Captions may have been off; unknown.
        seen = {a: True for a in AGENT_IDS}
    states = {}
    if not logs and not active and not finished:
        states = {a: "idle" for a in AGENT_IDS}
    else:
        # Analysis stages run strictly one after another.
        linear = ["ingest", "library", "whisper", "vision", "slicer"]
        render_started = started > 0 or (total is not None)
        furthest = max((linear.index(a) for a in linear if seen[a]), default=-1)
        if status == "processing" and furthest < 0:
            furthest = 0  # the worker has the file: ingest is the stage in flight
        for i, a in enumerate(linear):
            if render_started or finished:
                states[a] = "done" if seen[a] or a == "ingest" else "skipped"
            elif i < furthest:
                states[a] = "done" if seen[a] or a == "ingest" else "skipped"
            elif i == furthest:
                states[a] = "waiting" if status == "queued" else "working"
            else:
                states[a] = "waiting"
        if status == "queued":
            states["ingest"] = "waiting"
        # Rendering runs clips in parallel: these three can work at once.
        if finished:
            states["editor916"] = "done"
            states["captions"] = "done" if seen["captions"] else "skipped"
            states["social"] = "done"
        elif not render_started:
            states.update(editor916="waiting", captions="waiting", social="waiting")
        else:
            n = total or started
            states["editor916"] = ("working" if started > reframed or started < n
                                   else "done")
            states["captions"] = ("working" if reframed > ready else
                                  "done" if n and ready >= n and seen["captions"] else
                                  "skipped" if n and ready >= n else "waiting")
            states["social"] = "working" if n and ready >= n else ("waiting" if ready == 0 else "working")
        if status in ("failed", "cancelled"):
            for a in AGENT_IDS:
                if states.get(a) == "working":
                    states[a] = "failed" if status == "failed" else "stopped"
                elif states.get(a) == "waiting":
                    states[a] = "stopped"

    # Progress: analysis is ~55% of the wall time on CPU, rendering the rest.
    weights = {"ingest": 5, "library": 3, "whisper": 27, "vision": 15, "slicer": 5}
    pct = 0.0
    for a, w in weights.items():
        st = states.get(a)
        # Whisper reports its own percentage; before the first report it has
        # done nothing yet (assuming half would make the bar jump backwards).
        part = ((whisper_pct or 0) / 100.0) if a == "whisper" else 0.5
        pct += w if st in ("done", "skipped") else (w * part if st == "working" else 0)
    n = total or 0
    if n:
        pct += 45.0 * (0.15 * started + 0.55 * reframed + 0.30 * ready) / n
    if finished:
        pct = 100.0
    pct = int(max(0, min(99 if active else 100, round(pct))))

    working = [a for a in AGENT_IDS if states.get(a) == "working"]
    if working:
        step = AGENT_IDS.index(working[0]) + 1
        step_label = _BY_ID[working[0]]["name"]
    elif finished:
        step, step_label = len(AGENT_IDS), "Concluído"
    elif status == "queued":
        step, step_label = 1, "Na fila"
    else:
        done_n = sum(1 for a in AGENT_IDS if states.get(a) in ("done", "skipped"))
        step, step_label = min(len(AGENT_IDS), done_n + 1), ""

    return {
        "status": status,
        "agents": [{**a, "state": states.get(a["id"], "idle")} for a in AGENTS],
        "working": working,
        "step": step, "steps": len(AGENT_IDS), "step_label": step_label,
        "progress": pct,
        "clips": {"total": total, "started": started, "reframed": reframed, "ready": ready},
        "whisper_pct": whisper_pct,
        "console": console,
    }


# --------------------------------------------------------------------------- #
# FFprobe validation summary (printed by the pipeline, shown by the Ingest agent)
# --------------------------------------------------------------------------- #
def probe_summary(path):
    """Real container facts for the Ingest agent. Returns {} when unreadable."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
            capture_output=True, text=True, timeout=60)
        data = json.loads(out.stdout or "{}")
    except (OSError, ValueError, subprocess.SubprocessError):
        return {}
    v = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    a = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
    if not v:
        return {}
    fps = 0.0
    try:
        num, den = (v.get("avg_frame_rate") or "0/1").split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    except (ValueError, ZeroDivisionError):
        pass
    try:
        duration = float((data.get("format") or {}).get("duration") or v.get("duration") or 0)
    except ValueError:
        duration = 0.0
    return {
        "width": int(v.get("width") or 0), "height": int(v.get("height") or 0),
        "fps": round(fps, 2), "duration": round(duration, 2), "vcodec": v.get("codec_name"),
        "acodec": a.get("codec_name") if a else None,
        "sample_rate": int(a.get("sample_rate") or 0) if a else None,
        "channels": int(a.get("channels") or 0) if a else None,
        "container": ((data.get("format") or {}).get("format_name") or "").split(",")[0],
    }


def describe_probe(p, tail=" Original preservado."):
    if not p:
        return "Arquivo validado." + tail
    mins, secs = divmod(int(round(p["duration"])), 60)
    audio = (f"áudio {p['acodec']} {p['sample_rate'] // 1000 if p['sample_rate'] else '?'} kHz"
             if p.get("acodec") else "sem faixa de áudio")
    fps = f"{p['fps']:g} fps" if p.get("fps") else "fps desconhecido"
    return (f"Arquivo validado: {p['width']}x{p['height']}, {fps}, {mins}min{secs:02d}s, "
            f"vídeo {p['vcodec']}, {audio}.{tail}")


# --------------------------------------------------------------------------- #
# "Executar Teste Completo": a short, real check of the local toolchain
# --------------------------------------------------------------------------- #
def _run(cmd, timeout=120):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def self_test(output_dir, games_count=None):
    """Runs real commands (a few seconds) and reports each result.

    It renders a tiny synthetic 1080x1920 H.264/AAC clip and feeds it to the
    same audio/visual extractors the moment engine uses. Nothing is mocked: a
    step is only ``ok`` when the command really succeeded.
    """
    results = []

    def step(name, fn, optional=False):
        t0 = time.time()
        try:
            ok, detail = fn()
        except Exception as e:  # a broken tool must show up as a failed step, not a 500
            ok, detail = False, f"{type(e).__name__}: {e}"
        results.append({"name": name, "ok": bool(ok), "optional": optional, "detail": str(detail)[:300],
                        "ms": int((time.time() - t0) * 1000)})
        return ok

    def ffmpeg_ok():
        out = _run(["ffmpeg", "-hide_banner", "-version"], 15)
        return out.returncode == 0, (out.stdout.splitlines() or ["sem saída"])[0]

    def ffprobe_ok():
        out = _run(["ffprobe", "-hide_banner", "-version"], 15)
        return out.returncode == 0, (out.stdout.splitlines() or ["sem saída"])[0]

    def encoders_ok():
        out = _run(["ffmpeg", "-hide_banner", "-encoders"], 15).stdout
        have = [n for n in ("libx264", "aac") if re.search(rf"\s{n}\s", out)]
        return len(have) == 2, "Codificadores disponíveis: " + (", ".join(have) or "nenhum")

    def whisper_ok():
        import faster_whisper  # noqa: F401
        model = os.environ.get("WHISPER_MODEL", "small")
        return True, (f"faster-whisper {getattr(faster_whisper, '__version__', '')} instalado; "
                      f"modelo configurado: {model} ({os.environ.get('WHISPER_DEVICE', 'cpu')}).")

    def disk_ok():
        os.makedirs(output_dir, exist_ok=True)
        probe = os.path.join(output_dir, f".selftest-{os.getpid()}")
        with open(probe, "w") as f:
            f.write("ok")
        os.remove(probe)
        free = shutil.disk_usage(output_dir).free
        return free > 2 * 1024 ** 3, f"Pasta de saída gravável; {free / 1024 ** 3:.1f} GB livres."

    def library_ok():
        return (games_count or 0) > 0, f"{games_count or 0} jogo(s) na biblioteca."

    tmp = tempfile.mkdtemp(prefix="os-selftest-")
    src = os.path.join(tmp, "fonte.mp4")
    out_clip = os.path.join(tmp, "corte.mp4")

    def synth_ok():
        # 6 s of test pattern with a loud burst at 3 s: a moment with real evidence.
        r = _run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                  "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6",
                  "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
                  "-af", "volume='if(between(t,3,3.6),1.0,0.03)':eval=frame",
                  "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                  "-c:a", "aac", "-shortest", src])
        return r.returncode == 0 and os.path.getsize(src) > 0, "Vídeo de teste sintético gerado (6 s)."

    def probe_ok():
        p = probe_summary(src)
        return bool(p) and p["width"] == 640, describe_probe(p, tail="")

    def signals_ok():
        from . import signals
        af = signals.audio_features(src)
        vf = signals.visual_features(src)
        import numpy as np
        peak_t = float(np.argmax(af["rms_db"])) * 0.5
        ok = len(af["rms_db"]) >= 10 and len(vf["motion"]) >= 10 and 2.0 <= peak_t <= 4.5
        return ok, (f"Áudio: {len(af['rms_db'])} amostras, pico em {peak_t:.1f}s (esperado ≈3 s). "
                    f"Visual: {len(vf['motion'])} amostras.")

    def render_ok():
        r = _run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "2", "-t", "2", "-i", src,
                  "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,"
                         "pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
                  "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                  "-c:a", "aac", "-ar", "48000", out_clip])
        p = probe_summary(out_clip) if r.returncode == 0 else {}
        ok = (p.get("width"), p.get("height"), p.get("vcodec"), p.get("acodec")) == (1080, 1920, "h264", "aac")
        return ok, (f"Corte de teste: {p.get('width')}x{p.get('height')}, {p.get('vcodec')} + {p.get('acodec')}."
                    if p else (r.stderr or "falha no render")[-200:])

    try:
        has_ffmpeg = step("FFmpeg instalado", ffmpeg_ok)
        step("FFprobe instalado", ffprobe_ok)
        if has_ffmpeg:
            step("Codificadores H.264 e AAC", encoders_ok)
        step("Faster-Whisper (transcrição local)", whisper_ok)
        step("Pasta de saída e espaço em disco", disk_ok)
        step("Biblioteca de jogos", library_ok)
        if has_ffmpeg and step("Gerar vídeo de teste", synth_ok):
            step("Validação FFprobe (Agente Ingestão)", probe_ok)
            step("Sinais de áudio e imagem (Agente Detector)", signals_ok)
            step("Render 1080x1920 H.264 + AAC (Agente FFmpeg)", render_ok)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    required = [r for r in results if not r["optional"]]
    return {"ok": all(r["ok"] for r in required), "passed": sum(1 for r in required if r["ok"]),
            "total": len(required), "results": results, "ran_at": time.time()}
