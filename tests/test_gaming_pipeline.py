"""Sede Virtual: agent states must come from what the pipeline really printed.

The fixture is the untouched log of a real Gaming Edition run (3-minute
gameplay, local engine, 3 clips rendered in parallel).
"""
import json
import os

import pytest

from gaming import pipeline

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "gaming_job_log.json")


@pytest.fixture(scope="module")
def logs():
    with open(FIXTURE, encoding="utf-8") as f:
        return json.load(f)


def states(snap):
    """The eight pipeline stages (the Marvel helpers are tested on their own)."""
    return {a["id"]: a["state"] for a in snap["agents"] if a["id"] in pipeline.AGENT_IDS}


def ajudantes(snap):
    return {a["id"]: a["state"] for a in snap["agents"] if a["id"] not in pipeline.AGENT_IDS}


def cut_after(logs, needle):
    """Log up to and including the first line containing ``needle``."""
    i = next(i for i, ln in enumerate(logs) if needle in ln)
    return logs[: i + 1]


def test_agents_follow_the_real_execution_order():
    assert pipeline.AGENT_IDS == [
        "ingest", "library", "whisper", "vision", "slicer", "editor916", "captions", "social"]
    assert all(a["name"] and a["role"] and a["module"] and a["does"] for a in pipeline.AGENTS)


@pytest.mark.parametrize("line,agent", [
    ("📦 Arquivo validado: 1280x720, 30 fps, 3min00s, vídeo h264, áudio aac 44 kHz. Original preservado.", "ingest"),
    ("🎮 Jogo identificado pelo nome do arquivo: Free Fire — perfil FPS e Battle Royale.", "library"),
    ("🎮 Jogo selecionado: Minecraft — perfil Sobrevivência.", "library"),
    ("🎙️  Transcribing video...", "whisper"),
    ("[25.08s -> 27.92s]  Olha ali, olha ali, matei dois na cabeça.", "whisper"),
    ("🎧 Análise de áudio (local)...", "vision"),
    ("👁️ Análise visual (local)...", "vision"),
    ("✂️ Selecionando janelas de 30s com contexto (picos de áudio, imagem e fala)...", "slicer"),
    ("🎮 3 momento(s) com evidência encontrados.", "slicer"),
    ("🎬 Processing Clip 2: 56.5s - 86.5s", "editor916"),
    ("⏱️ Reframe v2 total: 91.0s", "editor916"),
    ("   💬 Captions burned: autosubs_1.mp4", "captions"),
    ("🪝 Hook burned (classic, 5s): QUE SUSTO!", "captions"),
    ("   ✅ Clip 2 ready: output/x/clip_2.mp4", "social"),
    ("Job started by worker.", "core"),
])
def test_classify_maps_real_lines_to_agents(line, agent):
    assert pipeline.classify(line)[0] == agent


def test_noise_is_not_attributed_to_any_agent():
    for line in ("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.",
                 "W0000 00:00:1794869597.859274    1369 inference_feedback_manager.cc:114] Feedback"):
        agent, _text, level = pipeline.classify(line)
        assert agent is None and level == "raw"


def test_nothing_runs_before_the_worker_takes_the_job():
    snap = pipeline.snapshot(["Job x queued."], "queued")
    assert set(states(snap).values()) == {"waiting"}
    assert snap["working"] == [] and snap["progress"] == 0


def test_no_job_means_every_agent_is_idle():
    assert set(states(pipeline.snapshot([], None)).values()) == {"idle"}


def test_transcription_stage(logs):
    snap = pipeline.snapshot(cut_after(logs, "Transcribing… 50%"), "processing")
    st = states(snap)
    assert st["ingest"] == "done" and st["library"] == "done"
    assert st["whisper"] == "working"
    assert all(st[a] == "waiting" for a in ("vision", "slicer", "editor916", "captions", "social"))
    assert snap["step"] == 3 and snap["whisper_pct"] == 50


def test_analysis_stage(logs):
    st = states(pipeline.snapshot(cut_after(logs, "Análise visual"), "processing"))
    assert st["whisper"] == "done" and st["vision"] == "working" and st["slicer"] == "waiting"


def test_render_stage_runs_agents_in_parallel(logs):
    # After the first reframe finishes, that clip is with the captions agent
    # while the other two are still being reframed.
    snap = pipeline.snapshot(cut_after(logs, "Reframe v2 total"), "processing")
    st = states(snap)
    assert st["slicer"] == "done"
    assert st["editor916"] == "working" and st["captions"] == "working"
    assert st["social"] == "waiting"
    assert snap["clips"] == {"total": 3, "started": 3, "reframed": 1, "ready": 0}


def test_completed_run_marks_every_agent_done(logs):
    snap = pipeline.snapshot(logs, "completed")
    assert set(states(snap).values()) == {"done"}
    assert snap["progress"] == 100 and snap["working"] == []
    assert snap["clips"]["ready"] == snap["clips"]["total"] == 3


def test_progress_never_goes_backwards_and_only_completion_reaches_100(logs):
    last = -1
    for n in range(1, len(logs)):
        pct = pipeline.snapshot(logs[:n], "processing")["progress"]
        assert pct >= last, f"progress dropped at line {n}: {logs[n - 1]!r}"
        assert pct <= 99
        last = pct
    assert pipeline.snapshot(logs, "completed")["progress"] == 100


def test_failure_is_shown_on_the_stage_that_was_running(logs):
    st = states(pipeline.snapshot(cut_after(logs, "Transcribing… 50%"), "failed"))
    assert st["ingest"] == "done" and st["whisper"] == "failed"
    assert st["vision"] == "stopped" and st["social"] == "stopped"


def test_cancel_stops_agents_without_marking_them_failed(logs):
    st = states(pipeline.snapshot(cut_after(logs, "Processing Clip 3"), "cancelled"))
    assert st["slicer"] == "done" and st["editor916"] == "stopped"
    assert "failed" not in st.values() and "working" not in st.values()


def test_skipped_captions_are_not_reported_as_done():
    logs = ["Job started by worker.", "📦 Arquivo validado: x", "🎙️  Transcribing video...",
            "🎧 Análise de áudio (local)...", "🔥 Found 1 clips!", "🎬 Processing Clip 1: 0s - 30s",
            "⏱️ Reframe v2 total: 9.0s", "   ✅ Clip 1 ready: a.mp4"]
    st = states(pipeline.snapshot(logs, "completed"))
    assert st["captions"] == "skipped" and st["library"] == "skipped"
    assert st["editor916"] == "done" and st["social"] == "done"


def test_job_recovered_from_disk_shows_as_completed():
    snap = pipeline.snapshot(["♻️ Job recovered from disk after server restart."], "completed")
    assert set(states(snap).values()) == {"done"}


def test_console_is_tagged_translated_and_not_flooded(logs):
    console = pipeline.snapshot(logs, "completed")["console"]
    texts = [c["text"] for c in console]
    # one line for all transcript segments instead of one per segment
    assert sum("trecho(s) de fala" in t for t in texts) == 1
    assert not any(t.startswith("[") and "s ->" in t for t in texts)
    # pipeline internals stay out of the console
    assert not any("TensorFlow" in t or "inference_feedback" in t for t in texts)
    # agent lines are in Portuguese and carry their agent
    line = next(c for c in console if c["text"].startswith("Corte 1: recortando"))
    assert line["agent"] == "editor916"
    assert any(c["agent"] == "social" and "aguardando aprovação manual" in c["text"] for c in console)
    assert console[-1]["agent"] == "core" and console[-1]["level"] == "ok"


def test_console_keeps_the_time_each_line_arrived(logs):
    times = [1000.0 + i for i in range(len(logs))]
    console = pipeline.snapshot(logs, "completed", times)["console"]
    first_agent_line = next(c for c in console if c["agent"] == "ingest")
    assert first_agent_line["t"] == times[next(i for i, ln in enumerate(logs) if "Arquivo validado" in ln)]


def test_timed_logs_record_arrival_time_and_stay_a_plain_list():
    lg = pipeline.TimedLogs(["a"])
    lg.append("b")
    assert lg == ["a", "b"] and len(lg.times) == 2
    assert lg.times[1] >= lg.times[0]
    assert json.loads(json.dumps(lg)) == ["a", "b"]


def test_probe_description_is_readable():
    text = pipeline.describe_probe({"width": 1920, "height": 1080, "fps": 60.0, "duration": 3725.4,
                                    "vcodec": "h264", "acodec": "aac", "sample_rate": 48000, "channels": 2})
    assert text == ("Arquivo validado: 1920x1080, 60 fps, 62min05s, vídeo h264, áudio aac 48 kHz. "
                    "Original preservado.")
    assert "sem faixa de áudio" in pipeline.describe_probe(
        {"width": 1280, "height": 720, "fps": 30.0, "duration": 10, "vcodec": "h264", "acodec": None,
         "sample_rate": None, "channels": None})


# ---- download errors in plain Portuguese -------------------------------------
YT_BOT_LOG = [
    "📥 Downloading video from YouTube...",
    "Traceback (most recent call last):",
    '  File "/app/main.py", line 900, in download_youtube_video',
    "    raise DownloadError(message, exc_info)",
    "    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "    self.trouble(*args, **kwargs)",
    "  _format_err('ERROR:', self.Styles.ERROR)} {message}', *args, **kwargs)",
    "yt_dlp.utils.DownloadError: ERROR: [youtube] 3JUboYgqlxc: Sign in to confirm you're not a bot. "
    "Use --cookies-from-browser or --cookies for the authentication.",
    "Process failed with exit code 1",
]


def test_youtube_bot_check_is_explained_and_traceback_hidden():
    snap = pipeline.snapshot(YT_BOT_LOG, "failed")
    texts = [c["text"] for c in snap["console"]]
    assert any("O YouTube bloqueou o download" in t for t in texts)
    assert any("parou com erro (código 1)" in t for t in texts)
    assert not any("Traceback" in t or "raise " in t or "_format_err" in t or "^^^" in t for t in texts)
    bot = next(c for c in snap["console"] if "YouTube bloqueou" in c["text"])
    assert bot["agent"] == "ingest" and bot["level"] == "error"


def test_other_download_errors_in_portuguese():
    for line, expect in [
        ("ERROR: [youtube] abc: Private video. Sign in if you've been granted access", "privado"),
        ("ERROR: [youtube] abc: Video unavailable", "não está disponível"),
        ("ERROR: Unsupported URL: https://exemplo.com/x", "não é de um vídeo"),
        ("ERROR: unable to download video data: HTTP Error 429: Too Many Requests", "limitou os downloads"),
    ]:
        agent, text, level = pipeline.classify(line)
        assert expect in text and level == "error" and agent == "ingest", line


def test_unreachable_host_is_explained_once():
    log = ["socket.gaierror: [Errno -2] Name or service not known",
           "security_utils.UnsafeURLError: Could not resolve host 'www.youtube.com': [Errno -2] Name or service not known",
           "Process failed with exit code 1"]
    texts = [c["text"] for c in pipeline.snapshot(log, "failed")["console"]]
    assert sum("Não foi possível acessar o site do link" in t for t in texts) == 1
    assert not any("gaierror" in t or "UnsafeURLError" in t for t in texts)


def test_marvel_helpers_light_up_only_when_they_really_worked():
    logs = ["Job started by worker", "🎮 Jogo selecionado: Free Fire — perfil FPS.",
            "📈 Aprendizado do canal: No canal deste criador, os Shorts de Vitória têm mais visualizações.",
            "🎯 Leitor do placar: avisos do jogo na tela (local)..."]
    a = ajudantes(pipeline.snapshot(logs, "processing"))
    assert a["x51"] == "working" and a["homer"] == "working"
    assert a["aida"] == "waiting" and a["herbie"] == "idle" and a["baymax"] == "idle"
    done = ajudantes(pipeline.snapshot(logs + ["✍️ Roteirista de títulos: 3 título(s) escolhido(s)",
                                                       "Process finished successfully"], "completed"))
    assert done["x51"] == done["homer"] == done["aida"] == "done"
    sem = ajudantes(pipeline.snapshot(["Job started by worker", "Process finished successfully"], "completed"))
    assert sem["aida"] == "skipped"                      # no Gemini: the writer had nothing to do


def test_helpers_are_not_pipeline_steps():
    snap = pipeline.snapshot(["Job started by worker"], "processing")
    assert snap["steps"] == 8 and len(snap["agents"]) == 13
