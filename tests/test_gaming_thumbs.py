"""Local thumbnails: a real frame from the clip plus the title, no API."""
import os
import subprocess

import numpy as np
import pytest
from PIL import Image

from gaming import thumbs


@pytest.fixture(scope="module")
def clip(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("thumb") / "clip.mp4")
    # 2 s black, then 4 s of a detailed test pattern: the sharp part is the pattern.
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=black:s=540x960:r=30:d=2",
                        "-f", "lavfi", "-i", "testsrc2=s=540x960:r=30:d=4", "-filter_complex", "[0][1]concat=n=2:v=1",
                        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", path], capture_output=True)
    assert r.returncode == 0, r.stderr
    return path


def test_picks_a_lit_sharp_frame_not_a_black_one(clip):
    frame = thumbs.best_frame(clip, at=2.0)     # window covers black and pattern
    assert frame is not None and frame.mean() > 40


def test_thumbnail_keeps_the_clip_size_and_writes_a_jpeg(clip, tmp_path):
    out = str(tmp_path / "t.jpg")
    info = thumbs.make(clip, out, "Vitória no último segundo: ação!", at=4.0, tag="Free Fire")
    img = Image.open(out)
    assert img.format == "JPEG" and img.size == (540, 960) == (info["width"], info["height"])
    assert not os.path.exists(out + ".tmp.jpg")


def test_title_is_actually_drawn(clip, tmp_path):
    a, b = str(tmp_path / "a.jpg"), str(tmp_path / "b.jpg")
    frame = thumbs.best_frame(clip, at=4.0)
    thumbs.render(frame, a, "")
    thumbs.render(frame, b, "HEADSHOT INSANO")
    diff = np.abs(np.asarray(Image.open(a), dtype=int) - np.asarray(Image.open(b), dtype=int))
    assert (diff > 60).mean() > 0.01, "the text must change a visible share of the image"


def test_very_long_title_still_fits(clip, tmp_path):
    out = str(tmp_path / "long.jpg")
    thumbs.make(clip, out, "palavra " * 40, at=4.0)
    assert Image.open(out).size == (540, 960)


def test_unreadable_video_is_an_error_not_a_blank_image(tmp_path):
    bad = str(tmp_path / "x.mp4")
    open(bad, "wb").write(b"not a video")
    with pytest.raises(RuntimeError):
        thumbs.make(bad, str(tmp_path / "o.jpg"), "x", at=1.0)
