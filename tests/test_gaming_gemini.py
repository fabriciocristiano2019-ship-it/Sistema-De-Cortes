"""Professional mode: Gemini picks/writes on top of the local candidates."""
import json
import os
import subprocess

import pytest

from gaming import gemini_judge as gj

GAME = {"id": "ff", "name": "Free Fire", "category": "fps_br"}
SETTINGS = {"clip_seconds": 30, "max_clips": 2, "min_score": 30}


def _pool():
    return [
        {"start": 10.0, "end": 40.0, "peak_time": 26.0, "relevance_score": 80, "moment_category": "headshot",
         "moment_label": "Headshot", "evidence": ["pico de volume"], "video_title_for_youtube_short": "local 1",
         "description": "d1", "viral_hook_text": "HEADSHOT!"},
        {"start": 60.0, "end": 90.0, "peak_time": 75.0, "relevance_score": 70, "moment_category": "susto",
         "moment_label": "Susto", "evidence": [], "video_title_for_youtube_short": "local 2", "description": "d2"},
        {"start": 120.0, "end": 150.0, "peak_time": 130.0, "relevance_score": 40, "moment_category": "jogada",
         "moment_label": "Jogada", "evidence": [], "video_title_for_youtube_short": "local 3", "description": "d3"},
    ]


TRANSCRIPT = {"segments": [{"start": 25, "end": 28, "text": " matei dois na cabeca",
                            "words": [{"word": " matei", "start": 25, "end": 25.4}, {"word": " dois", "start": 25.5, "end": 25.8},
                                      {"word": " na", "start": 26, "end": 26.1}, {"word": " cabeca,", "start": 26.2, "end": 26.7}]}]}


def _verdict():
    return {
        "picks": [
            {"id": 0, "keep": True, "score": 92, "start": 12.0, "end": 41.0, "moment_category": "headshot",
             "title": "Capa dupla no Free Fire", "description": "Dois de capa seguidos.",
             "hashtags": ["freefire", "#Headshot", "#gaming!"], "hook": "que capa", "reason": "ação clara"},
            {"id": 1, "keep": False, "score": 20, "start": 60, "end": 90, "moment_category": "susto",
             "title": "x", "description": "x", "hashtags": [], "hook": "x", "reason": "parado"},
            {"id": 2, "keep": True, "score": 75, "start": 100.0, "end": 200.0, "moment_category": "inventada",
             "title": "Rush insano", "description": "Rush.", "hashtags": ["#rush"], "hook": "RUSH!", "reason": "rush"},
        ],
        "corrections": [{"wrong": "cabeca", "right": "cabeça"}, {"wrong": "duas palavras", "right": "x"}],
    }


def test_verdict_is_validated():
    pool = _pool()
    cands = gj.build_candidates(pool, TRANSCRIPT)
    assert cands[0]["fala"].startswith("matei dois")
    clips = gj.apply_verdict(_verdict(), cands, pool, GAME, SETTINGS, duration=180)
    assert [c["video_title_for_youtube_short"] for c in clips] == ["Capa dupla no Free Fire", "Rush insano"]
    a, b = clips
    assert (a["start"], a["end"]) == (12.0, 41.0)                 # small, valid adjustment kept
    assert (b["start"], b["end"]) == (120.0, 150.0)               # 100 s clip refused -> candidate cut
    assert b["moment_category"] == "jogada"                       # unknown category -> local one
    assert a["hashtags"][0] == "#freefire" and "#gaming" in a["hashtags"]
    assert a["viral_hook_text"] == "QUE CAPA" and a["analysis_engine"] == "gemini"
    assert a["evidence"][0] == "IA: ação clara"
    assert "#freefire" in a["video_description_for_tiktok"]


def test_rejected_or_low_scores_are_dropped():
    pool = _pool()
    cands = gj.build_candidates(pool, TRANSCRIPT)
    v = {"picks": [{**p, "keep": False} for p in _verdict()["picks"]]}
    assert gj.apply_verdict(v, cands, pool, GAME, SETTINGS, 180) == []


def test_corrections_keep_timings():
    t = json.loads(json.dumps(TRANSCRIPT))
    assert gj.apply_corrections(t, _verdict()["corrections"]) == 1
    w = t["segments"][0]["words"][3]
    assert w["word"] == " cabeça," and (w["start"], w["end"]) == (26.2, 26.7)
    assert "cabeça" in t["segments"][0]["text"]


class _Resp:
    def __init__(self, payload):
        self.parsed = None
        self.text = json.dumps(payload)


class _Client:
    def __init__(self, payload=None, error=None):
        self.payload, self.error, self.calls = payload, error, []
        self.models = self

    def generate_content(self, model, contents, config):
        self.calls.append((model, contents))
        if self.error:
            raise self.error
        return _Resp(self.payload)


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    p = str(tmp_path_factory.mktemp("v") / "v.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=10:duration=180",
                    "-pix_fmt", "yuv420p", p], check=True)
    return p


def test_judge_sends_frames_and_returns_clips(video):
    client = _Client(_verdict())
    t = json.loads(json.dumps(TRANSCRIPT))
    clips = gj.judge(video, t, 180, GAME, SETTINGS, _pool(), client=client, log=lambda *a: None)
    assert len(clips) == 2
    parts = client.calls[0][1][0].parts
    images = [p for p in parts if getattr(p, "inline_data", None)]
    assert len(images) == 9                                       # 3 candidates x 3 frames
    assert "Free Fire" in parts[0].text and "no máximo 2 cortes" in parts[0].text
    assert t["segments"][0]["words"][3]["word"] == " cabeça,"


def test_judge_failure_keeps_local(video):
    logs = []
    out = gj.judge(video, TRANSCRIPT, 180, GAME, SETTINGS, _pool(), client=_Client(error=RuntimeError("quota")),
                   log=logs.append)
    assert out is None and "motor local" in logs[-1]


def test_no_key_means_local(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert gj.judge("x.mp4", TRANSCRIPT, 180, GAME, SETTINGS, _pool()) is None


def test_whisper_hints_from_env(monkeypatch):
    import transcribe_backends as tb
    monkeypatch.setenv("WHISPER_LANGUAGE", "pt")
    monkeypatch.setenv("WHISPER_INITIAL_PROMPT", "Gameplay de Free Fire.")
    p = tb.whisper_params()
    assert p["language"] == "pt" and p["initial_prompt"] == "Gameplay de Free Fire." and p["word_timestamps"]
    monkeypatch.delenv("WHISPER_LANGUAGE"); monkeypatch.delenv("WHISPER_INITIAL_PROMPT")
    p = tb.whisper_params()
    assert "language" not in p and "initial_prompt" not in p


def test_error_messages_in_portuguese():
    assert "chave do Gemini inválida" in gj.explain_error(RuntimeError("400 INVALID_ARGUMENT API key not valid."))
    assert "cota" in gj.explain_error(RuntimeError("429 RESOURCE_EXHAUSTED"))
