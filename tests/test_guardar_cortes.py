"""Finished clips stay in the library forever (owner, 19-nov-2026).

Age and disk limits used to delete a whole job, finished clips included.
Now they only remove what rendering needed; the delivered file of every clip
(approved, pending or rejected) stays playable and postable.
"""
import json
import os
import time

import pytest

import gaming_api

JOB = "abc123job"
BASE = f"{JOB}_Free Fire gameplay"


def _job(root, n=2, approved=(True, None)):
    d = root / JOB
    (d / ".quadros").mkdir(parents=True)
    (d / ".quadros" / "f1.jpg").write_bytes(b"x" * 1000)
    shorts = []
    for i in range(n):
        k = i + 1
        (d / f"{BASE}_clip_{k}.mp4").write_bytes(b"c" * 5000)                 # clean copy
        (d / f"hooked_100{k}_{BASE}_clip_{k}.mp4").write_bytes(b"h" * 5000)    # with hook
        final = f"subtitled_200{k}_hooked_100{k}_{BASE}_clip_{k}.mp4"
        (d / final).write_bytes(b"s" * 5000)                                   # delivered
        shorts.append({"start": i * 30, "end": i * 30 + 30, "approved": approved[i],
                       "video_url": f"/videos/{JOB}/{final}"})
    (d / f"{BASE}.mp4").write_bytes(b"o" * 50000)                              # source video
    (d / f"{BASE}_metadata.json").write_text(json.dumps({"shorts": shorts}), encoding="utf-8")
    (d / "gaming_job.json").write_text("{}", encoding="utf-8")
    (d / f"{BASE}_clip_1.mp4.layout.json").write_text("{}", encoding="utf-8")
    return d


@pytest.fixture
def out(tmp_path, monkeypatch):
    monkeypatch.setitem(gaming_api._STATE, "output_dir", str(tmp_path))
    monkeypatch.setitem(gaming_api._STATE, "jobs", {})
    return tmp_path


def test_only_the_delivered_clips_survive(out):
    d = _job(out)
    freed = gaming_api.enxugar_trabalho(str(d))
    left = sorted(os.listdir(d))
    assert [f for f in left if f.endswith(".mp4")] == [
        f"subtitled_2001_hooked_1001_{BASE}_clip_1.mp4", f"subtitled_2002_hooked_1002_{BASE}_clip_2.mp4"]
    assert f"{BASE}_metadata.json" in left and "gaming_job.json" in left
    assert ".quadros" not in left
    assert freed == 50000 + 2 * 10000 + 1000
    assert gaming_api.enxugar_trabalho(str(d)) == 0          # once only


def test_pending_and_rejected_clips_are_kept_too(out):
    d = _job(out, approved=(None, False))
    gaming_api.enxugar_trabalho(str(d))
    assert len([f for f in os.listdir(d) if f.startswith("subtitled_")]) == 2


def test_the_library_still_lists_and_plays_them(out):
    d = _job(out)
    gaming_api.enxugar_trabalho(str(d))
    meta = str(d / f"{BASE}_metadata.json")
    for i in range(2):
        url = gaming_api._clip_url(JOB, meta, i, json.load(open(meta))["shorts"][i])
        assert url and os.path.exists(d / url.rsplit("/", 1)[-1])


def test_a_clip_without_a_known_file_keeps_the_whole_job(out):
    d = _job(out)
    for f in os.listdir(d):
        if f.endswith("_clip_2.mp4"):
            os.remove(d / f)
    before = sorted(os.listdir(d))
    assert gaming_api.enxugar_trabalho(str(d)) == 0
    assert sorted(os.listdir(d)) == before


def test_not_a_gaming_job_is_left_alone(out):
    d = out / "other"
    d.mkdir()
    (d / "x.mp4").write_bytes(b"x")
    assert gaming_api.tem_cortes(str(d)) is False
    assert gaming_api.enxugar_trabalho(str(d)) == 0


def test_disk_cap_slims_instead_of_deleting(out, monkeypatch):
    import app as app_module
    d = _job(out)
    monkeypatch.setattr(app_module, "OUTPUT_DIR", str(out))
    monkeypatch.setattr(app_module, "OUTPUT_MAX_GB", 1)
    monkeypatch.setattr(app_module, "_dir_size", lambda p: 2 * 1024 ** 3 if p == str(out) else 1)
    app_module._enforce_output_size_cap()
    assert d.exists()
    assert len([f for f in os.listdir(d) if f.startswith("subtitled_")]) == 2
    assert not (d / f"{BASE}.mp4").exists()


def test_the_captioned_copy_wins_even_when_file_dates_are_equal(out):
    d = _job(out)
    meta = d / f"{BASE}_metadata.json"
    data = json.loads(meta.read_text(encoding="utf-8"))
    for c in data["shorts"]:
        c.pop("video_url")                      # nothing recorded: decide by the files
    meta.write_text(json.dumps(data), encoding="utf-8")
    for f in os.listdir(d):
        os.utime(d / f, (1000, 1000))           # a copy that lost the dates
    gaming_api.enxugar_trabalho(str(d))
    assert sorted(f for f in os.listdir(d) if f.endswith(".mp4")) == [
        f"subtitled_2001_hooked_1001_{BASE}_clip_1.mp4", f"subtitled_2002_hooked_1002_{BASE}_clip_2.mp4"]
