"""Colour and safe zone of the delivered clip (reel-export skill, 19-nov-2026).

Measured before the fix: no colour tags on the file, and captions reaching
into the bottom 500 px that Reels/TikTok cover.
"""
import json
import shutil
import subprocess

import pytest

import subtitles

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg ausente")

ASS = """[Script Info]
ScriptType: v4.00+
PlayResY: 288
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,120,&H0000E5FF,&H0000E5FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\p1}m 0 0 l 200 0 200 200 0 200{\\p0}
"""


def _rgb_no_meio(path):
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", "0.5", "-i", path, "-frames:v", "1", "-vf",
                          "scale=in_color_matrix=bt709:in_range=tv,format=rgb24,crop=8:8:536:956",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return out[0], out[1], out[2]


def test_burning_captions_keeps_the_frame_and_tags_the_file(tmp_path):
    base = str(tmp_path / "base.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x202020:s=1080x1920:d=1:r=30",
                    "-c:v", "libx264", "-crf", "12", base], check=True)
    ass = tmp_path / "c.ass"
    ass.write_text(ASS, encoding="utf-8")
    out = str(tmp_path / "out.mp4")
    assert subtitles.burn_subtitles(base, str(ass), out) is not False
    r, g, b = _rgb_no_meio(out)
    assert r >= 0xF5 and 0xCC <= g <= 0xEC and b <= 0x14, (r, g, b)    # still a bright yellow
    # The frame around it is untouched: a version-dependent RGB round trip
    # once turned the whole picture grey on GitHub's runner.
    fundo = subprocess.run(["ffmpeg", "-v", "error", "-ss", "0.5", "-i", out, "-frames:v", "1", "-vf",
                            "crop=8:8:40:40,format=gray", "-f", "rawvideo", "-"],
                           capture_output=True, check=True).stdout
    base_y = subprocess.run(["ffmpeg", "-v", "error", "-ss", "0.5", "-i", base, "-frames:v", "1", "-vf",
                             "crop=8:8:40:40,format=gray", "-f", "rawvideo", "-"],
                            capture_output=True, check=True).stdout
    assert abs(fundo[0] - base_y[0]) <= 2, (fundo[0], base_y[0])
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                      "stream=color_range,color_space,color_primaries,color_transfer",
                                      "-of", "json", out], capture_output=True, check=True).stdout)["streams"][0]
    # Range and matrix are what keep the apps from washing the clip out. Some
    # ffmpeg builds (GitHub's runner) do not write primaries/transfer; when
    # present they must be BT.709.
    assert info["color_range"] == "tv" and info["color_space"] == "bt709", info
    assert info.get("color_primaries", "bt709") == "bt709" and info.get("color_transfer", "bt709") == "bt709", info


def test_captions_stay_out_of_the_bottom_500px():
    assert subtitles.SAFE_MARGIN_V * 1920 / 288 >= 500
