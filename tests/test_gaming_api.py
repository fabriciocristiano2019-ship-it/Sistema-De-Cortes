"""Gaming Edition API helpers: request validation, layouts, publishing rules."""
import os

import pytest
from fastapi import HTTPException

import gaming_api
from gaming import library


@pytest.fixture(autouse=True)
def out(tmp_path, monkeypatch):
    monkeypatch.setitem(gaming_api._STATE, "output_dir", str(tmp_path))
    monkeypatch.setitem(gaming_api._STATE, "jobs", {})
    return str(tmp_path)


def test_plain_openshorts_jobs_are_untouched():
    assert gaming_api.parse_gaming(None) is None
    assert gaming_api.parse_gaming("") is None


def test_defaults_are_free_and_local():
    req = gaming_api.parse_gaming("{}")
    assert req["engine"] == "local" and req["layout"] == "auto"
    assert req["game"] == {"id": "auto"}
    assert req["settings"]["clip_seconds"] == 30


@pytest.mark.parametrize("seconds", [15, 30, 45, 60, 22.5, 5, 180])
def test_standard_and_custom_durations_are_accepted(seconds):
    assert gaming_api.parse_gaming({"clip_seconds": seconds})["settings"]["clip_seconds"] == seconds


@pytest.mark.parametrize("bad", [
    "not json", "[1, 2]", {"engine": "gpt"}, {"layout": "diagonal"}, {"clip_seconds": 2},
    {"clip_seconds": 600}, {"clip_seconds": "abc"}, {"max_clips": 0}, {"max_clips": 99},
    {"min_score": 150}, {"inset_box": [0.1, 0.2]}, {"inset_box": [0, 0, 2, 1]},
])
def test_invalid_requests_are_rejected_with_a_400(bad):
    with pytest.raises(HTTPException) as e:
        gaming_api.parse_gaming(bad)
    assert e.value.status_code == 400


def test_unknown_game_is_a_404(out):
    with pytest.raises(HTTPException) as e:
        gaming_api.parse_gaming({"game_id": "nao-existe"})
    assert e.value.status_code == 404


def test_selected_game_brings_its_category(out):
    g = library.create(out, {"name": "Dead by Daylight", "category": "horror"})
    req = gaming_api.parse_gaming({"game_id": g["id"]})
    assert req["game"] == {"id": g["id"], "name": "Dead by Daylight", "category": "horror"}


def test_layout_options_map_to_render_strategies():
    env = lambda **kw: gaming_api.job_env(gaming_api.parse_gaming(kw))  # noqa: E731
    # A: full screen keeps the whole frame, so the HUD is never cropped
    assert env(layout="full")["FORCE_STRATEGY"] == "WIDE"
    # B: gameplay + webcam
    assert env(layout="webcam")["FORCE_STRATEGY"] == "INSET"
    # C: adapted to vertical
    assert env(layout="vertical")["FORCE_STRATEGY"] == "TRACK"
    assert "FORCE_STRATEGY" not in env(layout="auto")


def test_local_engine_never_enables_the_gemini_layout_picker():
    assert gaming_api.job_env(gaming_api.parse_gaming({"engine": "local"}))["AUTO_LAYOUT"] == "0"
    assert gaming_api.job_env(gaming_api.parse_gaming({"layout": "full", "engine": "gemini"}))["AUTO_LAYOUT"] == "0"


def test_manual_webcam_box_and_zoom_reach_the_renderer():
    env = gaming_api.job_env(gaming_api.parse_gaming(
        {"layout": "webcam", "inset_box": [0.7, 0.05, 0.25, 0.3], "zoom": True}))
    assert env["INSET_BOX"] == "0.7000,0.0500,0.2500,0.3000"
    assert env["PUNCH_IN"] == "1"
    assert "PUNCH_IN" not in gaming_api.job_env(gaming_api.parse_gaming({"zoom": False}))


def test_job_config_records_what_was_asked(out):
    job_dir = os.path.join(out, "job-1")
    os.makedirs(job_dir)
    req = gaming_api.parse_gaming({"layout": "full", "clip_seconds": 45})
    path = gaming_api.write_job_config(job_dir, req, "/uploads/job-1_Minha Partida.mp4")
    assert gaming_api._job_layout(job_dir) == "full"
    assert os.path.basename(path) == "gaming_job.json"
    assert gaming_api._job_layout(os.path.join(out, "missing")) is None


def test_views_and_likes_are_summed_across_networks():
    rows = [
        {"platform": "tiktok", "title": "A", "views": 1200, "likes": 90, "comments": 4, "shares": 2},
        {"platform": "instagram", "title": "B", "plays": "300", "like_count": 25},
        {"platform": "youtube", "title": "C", "view_count": 50, "likes": None},
        {"platform": "tiktok", "title": "D"},
    ]
    agg = gaming_api.aggregate_post_metrics(rows)
    assert agg["totals"]["views"] == 1550 and agg["totals"]["likes"] == 115
    assert agg["totals"]["comments"] == 4 and agg["totals"]["shares"] == 2
    assert agg["totals"]["posts"] == 4
    assert agg["top_posts"][0]["title"] == "A"
    tiktok = next(p for p in agg["per_platform"] if p["platform"] == "tiktok")
    assert tiktok["posts"] == 2 and tiktok["views"] == 1200


def test_metrics_with_no_posts_are_zero_not_an_error():
    agg = gaming_api.aggregate_post_metrics([])
    assert agg["totals"] == {"views": 0, "likes": 0, "comments": 0, "shares": 0, "posts": 0}
    assert agg["per_platform"] == [] and agg["top_posts"] == []


def test_queue_counts_only_running_and_waiting_jobs(monkeypatch):
    monkeypatch.setitem(gaming_api._STATE, "jobs", {
        "a": {"status": "processing"}, "b": {"status": "queued"}, "c": {"status": "queued"},
        "d": {"status": "completed"}, "e": {"status": "failed"}})
    assert gaming_api._queue_counts() == {"jobs_active": 1, "jobs_queued": 2}
