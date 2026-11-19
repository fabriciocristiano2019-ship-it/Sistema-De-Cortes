"""Edição profissional dos cortes (owner, 19-nov-2026): montage without zoom,
webcam on top, animated opening, voice-over that never breaks a clip."""
import json
import shutil
import subprocess

import pytest

from gaming import acabamento, montagem, voz

FFMPEG = shutil.which("ffmpeg") is not None


def test_montage_keeps_the_whole_game_and_never_zooms():
    g = montagem.geometria(1920, 1080)
    assert g["tipo"] == "pro" and g["jogo"][1] - g["jogo"][0] == 608      # 1080 wide, 16:9 kept
    assert montagem.TOPO_SEGURO < g["titulo_y"] < g["jogo"][0]            # title in the band above
    assert g["legenda_base"] <= 1420                                       # captions out of the app UI
    graph, _ = montagem.filtergraph(1920, 1080)
    assert "scale=1080:608" in graph and "boxblur" in graph
    assert "zoompan" not in graph and "crop=1080:1920" in graph            # only the blurred fill is cropped


def test_webcam_goes_on_top_and_its_corner_is_blurred_in_the_game():
    g = montagem.geometria(1920, 1080, cam=(1500, 700, 380, 330))
    assert g["tipo"] == "pro_cam" and g["cam"] == [0, montagem.CAM_H] and g["jogo"][0] == montagem.CAM_H
    graph, _ = montagem.filtergraph(1920, 1080, cam=(1500, 700, 380, 330))
    assert "crop=380:330:1500:700,boxblur" in graph        # the face is not shown twice
    assert "overlay=0:0" in graph                          # camera band at the top


def test_camera_box_comes_from_fractions(monkeypatch):
    monkeypatch.setenv("INSET_BOX", "0.7813,0.6481,0.1979,0.3056")
    x, y, w, h = montagem.caixa_da_camera(1920, 1080)
    assert (x, y) == (1500, 700) and abs(w - 380) <= 2 and abs(h - 330) <= 2
    monkeypatch.setenv("INSET_BOX", "lixo")
    assert montagem.caixa_da_camera(1920, 1080) is None


def test_script_per_moment_and_a_real_hook_wins():
    t, f = acabamento.roteiro({"moment_category": "susto", "start": 3})
    assert t in ("ELE NÃO ESPERAVA ISSO", "QUE SUSTO FOI ESSE?!") and f
    t, f = acabamento.roteiro({"moment_category": "headshot", "viral_hook_text": "HEADSHOT!"})
    assert t != "HEADSHOT!"                                  # a one-word label is not a hook
    t, f = acabamento.roteiro({"viral_hook_text": "Ele achou que ia escapar 😱"})
    assert t == "ELE ACHOU QUE IA ESCAPAR" and f.startswith("Ele achou")


def test_titles_break_into_two_balanced_lines():
    assert acabamento.quebrar("OLHA O QUE ELE FEZ") == ["OLHA O QUE", "ELE FEZ"]
    assert acabamento.quebrar("GG") == ["GG"]


def test_opening_has_flash_pop_title_and_progress_bar(tmp_path):
    p = tmp_path / "a.ass"
    acabamento.gerar_ass(str(p), "ELE NÃO ESPERAVA ISSO", 13.5, {"tipo": "pro", "jogo": [620, 1226], "titulo_y": 430})
    s = p.read_text(encoding="utf-8")
    assert "PlayResX: 1080" in s and "PlayResY: 1920" in s
    assert ",Flash," in s and "\\fad(0,240)" in s                       # opening flash
    assert "\\fscx30\\fscy30" in s and "\\fscx112" in s                 # pop in
    assert "\\t(110," in s                                              # second line a beat later
    assert "\\c&H0000D4FF&}ESPERAVA" in s or "\\c&H0000D4FF&}ISSO" in s  # key words in yellow
    assert "\\clip(0,0,0,1920)\\t(0,13500,\\clip(0,0,1080,1920))" in s  # bar fills over the clip
    assert "\\pos(0,1226)" in s                                        # under the game


def test_with_webcam_the_title_stays_inside_the_camera(tmp_path):
    p = tmp_path / "b.ass"
    acabamento.gerar_ass(str(p), "QUE SUSTO FOI ESSE?!", 10, {"tipo": "pro_cam", "jogo": [600, 1206], "titulo_y": 600})
    faixa = [l for l in p.read_text(encoding="utf-8").splitlines() if ",Faixa," in l][0]
    y0 = int(faixa.split("\\pos(0,")[1].split(")")[0])
    altura = int(faixa.split(" l 1080 0 1080 ")[1].split()[0])
    assert y0 + altura <= 600                    # never over the game's HUD


def test_no_voice_installed_means_no_narration_not_an_error(monkeypatch, tmp_path):
    monkeypatch.setenv("GAMING_VOZ_MODELO", str(tmp_path / "nao-existe.onnx"))
    assert voz.disponivel() is False
    assert voz.gerar("Olha o que ele fez", str(tmp_path / "v.wav")) is None
    monkeypatch.setenv("GAMING_VOZ", "0")
    assert voz.disponivel() is False


@pytest.mark.skipif(not FFMPEG, reason="ffmpeg ausente")
def test_real_render_of_montage_and_opening(tmp_path):
    src = str(tmp_path / "jogo.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=3",
                    "-f", "lavfi", "-i", "sine=f=440:d=3", "-shortest", "-c:v", "libx264", "-c:a", "aac", src],
                   check=True)
    m = str(tmp_path / "m.mp4")
    assert montagem.render(src, m)
    assert montagem.ler(m)["tipo"] == "pro"
    voz_wav = str(tmp_path / "voz.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=1", voz_wav], check=True)
    out = str(tmp_path / "a.mp4")
    acabamento.aplicar(m, "OLHA O QUE ELE FEZ", out, geo=montagem.ler(m), voz=voz_wav)
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                                      "stream=codec_type,width,height:format=duration", "-of", "json", out],
                                     capture_output=True, check=True).stdout)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    assert (v["width"], v["height"]) == (1080, 1920)
    assert any(s["codec_type"] == "audio" for s in info["streams"])
    assert abs(float(info["format"]["duration"]) - 3.0) < 0.3      # voice never makes the clip longer
