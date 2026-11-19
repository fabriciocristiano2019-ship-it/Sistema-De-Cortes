"""Colour and safe zone of the delivered clip (reel-export skill, 19-nov-2026).

Measured before the fix: no colour tags on the file, and the yellow active
word of the captions came out #FFD900 instead of #FFE500 on a BT.709 player.
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


def test_caption_yellow_keeps_its_colour_and_the_file_is_tagged(tmp_path):
    base = str(tmp_path / "base.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x202020:s=1080x1920:d=1:r=30",
                    "-c:v", "libx264", "-crf", "12", base], check=True)
    ass = tmp_path / "c.ass"
    ass.write_text(ASS, encoding="utf-8")
    out = str(tmp_path / "out.mp4")
    assert subtitles.burn_subtitles(base, str(ass), out) is not False
    r, g, b = _rgb_no_meio(out)
    assert abs(r - 0xFF) <= 3 and abs(g - 0xE5) <= 4 and b <= 6, (r, g, b)   # was 0xD9 green
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                      "stream=color_range,color_space,color_primaries,color_transfer",
                                      "-of", "json", out], capture_output=True, check=True).stdout)["streams"][0]
    assert info == {"color_range": "tv", "color_space": "bt709", "color_primaries": "bt709",
                    "color_transfer": "bt709"}


def test_captions_stay_out_of_the_bottom_500px():
    assert subtitles.SAFE_MARGIN_V * 1920 / 288 >= 500
