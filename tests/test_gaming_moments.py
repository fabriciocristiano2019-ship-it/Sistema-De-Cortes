"""Local moment engine: clips need evidence, and evidence is not invented.

Features are synthetic arrays (one value per 0.5 s step, the same shape the
ffmpeg extractors return), so these tests need no video and no network.
"""
import numpy as np
import pytest

from gaming import moments
from gaming.signals import STEP

DURATION = 300.0
N = int(DURATION / STEP)


def quiet_features(seed=0):
    """A gameplay where nothing happens: the player talks in a normal voice
    with pauses (4 s of speech, 2 s of silence), the picture moves steadily."""
    rng = np.random.default_rng(seed)
    talking = (np.arange(N) % 12) < 8
    rms = np.where(talking, -25 + rng.normal(0, 1.2, N), -45 + rng.normal(0, 1.0, N))
    k = int(2 / STEP)
    prev = np.convolve(np.pad(rms, (k, 0), mode="edge")[:-1], np.ones(k) / k, mode="valid")[:N]
    audio = {"rms_db": rms, "spike_db": np.maximum(rms - prev, 0)}   # same formula as signals.audio_features
    visual = {"motion": 6 + rng.normal(0, 0.3, N), "cut": np.zeros(N),
              "flash": np.abs(rng.normal(0, 0.2, N)), "red": np.zeros(N)}
    return audio, visual


def add_event(features, t, audio=True, visual=True):
    """A real moment: the player shouts and the screen erupts for ~3 s."""
    af, vf = features
    i, j = int(t / STEP), int((t + 3) / STEP)
    if audio:
        af["rms_db"][i:j] = -8          # a shout, far above the talking level
        af["spike_db"][i:i + 2] = 18
    if visual:
        vf["motion"][i:j] += 30
        vf["flash"][i:i + 2] += 40
    return features


def transcript_at(t, text):
    words = text.split()
    return {"language": "pt", "segments": [{
        "start": t, "end": t + 0.4 * len(words), "text": text,
        "words": [{"word": w, "start": t + 0.4 * k, "end": t + 0.4 * k + 0.35} for k, w in enumerate(words)],
    }]}


def run(features, transcript=None, game=None, **settings):
    quiet = lambda *_a, **_k: None  # noqa: E731
    return moments.detect_moments(
        None, transcript, DURATION, game or {"id": "g1", "name": "Free Fire", "category": "fps_br"},
        settings, log=quiet, features=features)


def test_a_gameplay_where_nothing_happens_yields_no_clips():
    for seed in range(5):
        out = run(quiet_features(seed))
        assert out["shorts"] == [], f"seed {seed}: invented a moment out of noise"


def test_audio_and_visual_evidence_together_make_a_clip_around_the_event():
    out = run(add_event(quiet_features(), 150.0), clip_seconds=30)
    assert len(out["shorts"]) == 1
    clip = out["shorts"][0]
    assert clip["start"] < 150.0 < clip["end"], "the event must be inside the clip"
    assert clip["end"] - clip["start"] == pytest.approx(30, abs=2.5)
    # context before the peak: the clip does not start on the event itself
    assert 150.0 - clip["start"] >= 5
    assert len(clip["evidence"]) >= 2
    assert clip["relevance_score"] >= moments.DEFAULT_MIN_SCORE
    assert clip["approved"] is None, "nothing is pre-approved"


def test_picture_change_without_any_sound_or_speech_is_not_a_moment():
    # A menu or scene transition: the image changes a lot, the audio does not.
    out = run(add_event(quiet_features(), 150.0, audio=False))
    assert out["shorts"] == []
    assert out["analysis"]["candidates_single_signal"] >= 1


def test_a_sentence_after_a_pause_is_not_a_moment():
    # quiet_features is full of speech onsets (-45 dB -> -25 dB every 6 s):
    # each one is a sudden audio rise, none is louder than normal talking.
    out = run(quiet_features())
    assert out["shorts"] == []


def test_a_scream_alone_counts_because_it_is_far_louder_than_talking():
    out = run(add_event(quiet_features(), 150.0, visual=False))
    assert len(out["shorts"]) == 1
    clip = out["shorts"][0]
    assert clip["start"] < 150.0 < clip["end"]
    assert "pico de volume" in clip["evidence"]


def test_slightly_raised_voice_alone_is_not_a_moment():
    af, vf = quiet_features()
    i = int(150 / STEP)
    af["rms_db"][i:i + 6] = -19      # 6 dB over normal talking, nothing else happens
    assert run((af, vf))["shorts"] == []


@pytest.mark.parametrize("strong,audio_usable,expected", [
    (["keyword"], True, True),                      # the player named it
    (["laughter"], True, True),
    (["audio_peak", "motion"], True, True),         # sound + picture
    (["audio_spike", "speech_rate"], True, True),   # sound + excited speech
    (["audio_peak", "audio_spike"], True, True),    # loud AND sudden: a scream
    (["audio_spike"], True, False),                 # a sentence after a pause
    (["audio_peak"], True, False),                  # louder than usual, but not a scream
    (["motion", "flash"], True, False),             # scene cut / menu
    (["motion", "flash", "red"], True, False),
    (["speech_rate"], True, False),
    ([], True, False),
    (["motion", "flash"], False, True),             # silent video: picture is all there is
    (["motion"], False, False),
])
def test_evidence_gate(strong, audio_usable, expected):
    assert moments.has_evidence(strong, audio_usable) is expected


def test_exceptional_loudness_stands_alone():
    assert moments.has_evidence(["audio_peak"], True, audio_peak=1.0) is True
    assert moments.has_evidence(["audio_peak"], True, audio_peak=0.7) is False


def test_one_frame_scene_cut_in_a_silent_video_is_not_a_moment():
    assert moments.has_evidence(["motion", "flash"], False, sustained_visual=False) is False
    af = {"rms_db": np.zeros(0), "spike_db": np.zeros(0)}
    _, vf = quiet_features()
    i = int(150 / STEP)
    vf["motion"][i] += 60      # a single huge frame difference
    vf["flash"][i] += 40
    assert run((af, vf))["shorts"] == []


def test_flat_audio_track_is_treated_like_no_audio():
    af, vf = quiet_features()
    af = {"rms_db": np.full(N, -90.0), "spike_db": np.zeros(N)}     # digital silence
    i = int(150 / STEP)
    vf["motion"][i:i + 6] += 30
    vf["flash"][i:i + 2] += 40
    out = run((af, vf))
    assert out["analysis"]["has_audio"] is True and out["analysis"]["audio_usable"] is False
    assert len(out["shorts"]) == 1


def test_player_words_name_the_moment():
    feats = add_event(quiet_features(), 150.0)
    out = run(feats, transcript_at(150.5, "ai meu deus que susto socorro"), {"id": "g", "name": "Phasmophobia", "category": "horror"})
    assert len(out["shorts"]) == 1
    clip = out["shorts"][0]
    assert clip["moment_category"] == "susto"
    assert any("fala do jogador" in e for e in clip["evidence"])
    assert "Phasmophobia" in clip["video_title_for_youtube_short"]


def test_minimum_score_filters_weak_moments():
    feats = add_event(quiet_features(), 150.0)
    assert len(run(feats, min_score=0)["shorts"]) == 1
    assert run(add_event(quiet_features(), 150.0), min_score=100)["shorts"] in ([], run(feats, min_score=100)["shorts"])
    strict = run(add_event(quiet_features(), 150.0), min_score=101 - 1)
    for clip in strict["shorts"]:
        assert clip["relevance_score"] >= 100


def test_max_clips_is_respected_and_clips_never_overlap():
    feats = quiet_features()
    for t in (30.0, 90.0, 150.0, 210.0, 270.0):
        add_event(feats, t)
    out = run(feats, clip_seconds=30, max_clips=3)
    clips = sorted(out["shorts"], key=lambda c: c["start"])
    assert len(clips) == 3
    for a, b in zip(clips, clips[1:]):
        assert a["end"] <= b["start"]


@pytest.mark.parametrize("seconds", [15, 30, 45, 60, 22])
def test_requested_duration_is_honoured(seconds):
    out = run(add_event(quiet_features(), 150.0), clip_seconds=seconds)
    assert len(out["shorts"]) == 1
    clip = out["shorts"][0]
    assert clip["end"] - clip["start"] == pytest.approx(seconds, abs=2.5)
    assert 0 <= clip["start"] and clip["end"] <= DURATION


def test_every_clip_carries_what_the_panel_and_the_networks_need():
    clip = run(add_event(quiet_features(), 150.0))["shorts"][0]
    for key in ("start", "end", "start_timecode", "end_timecode", "relevance_score", "moment_category",
                "moment_label", "evidence", "game_name", "game_category", "video_title_for_youtube_short",
                "video_description_for_tiktok", "video_description_for_instagram", "description", "hashtags"):
        assert clip[key] is not None, key
        if isinstance(clip[key], (str, list)):
            assert len(clip[key]) > 0, key
    assert type(clip["start"]) is float and type(clip["end"]) is float, "plain JSON numbers"
    assert clip["start_timecode"] == "00:02:" + f"{int(clip['start']) - 120:02d}"
    assert all(tag.startswith("#") for tag in clip["hashtags"])
    assert clip["analysis_engine"] == "local"


def test_silent_video_still_finds_visual_moments():
    af = {"rms_db": np.zeros(0), "spike_db": np.zeros(0)}
    _, vf = quiet_features()
    i = int(150 / STEP)
    vf["motion"][i:i + 6] += 30
    vf["flash"][i:i + 2] += 40
    out = run((af, vf))
    assert out["analysis"]["has_audio"] is False
    assert len(out["shorts"]) == 1 and out["shorts"][0]["start"] < 150 < out["shorts"][0]["end"]


def test_unknown_duration_fails_safely():
    out = moments.detect_moments("/nonexistent/file.mp4", None, 0, {}, {}, log=lambda *_: None,
                                 features=quiet_features())
    assert out["shorts"] == [] and "error" in out["analysis"]
