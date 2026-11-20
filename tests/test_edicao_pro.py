"""Edição profissional dos cortes (owner, 19-nov-2026): montage without zoom,
webcam on top, animated opening, voice-over that never breaks a clip."""
import json
import shutil
import subprocess

import pytest

from gaming import acabamento, montagem, voz

FFMPEG = shutil.which("ffmpeg") is not None


def test_one_format_shorts_full_screen_without_webcam():
    g = montagem.geometria(1920, 1080)
    assert g["tipo"] == "shorts" and g["jogo"] == [0, 1920]
    assert montagem.TOPO_SEGURO < g["titulo_y"] < 600 and g["legenda_base"] <= 1420
    graph, _ = montagem.filtergraph(1920, 1080)
    assert "crop=1080:1920" in graph


def test_webcam_card_on_top_and_game_full_width_below():
    g = montagem.geometria(1920, 1080, cam=(1500, 700, 380, 330))
    x, y, w, h = montagem.CARTAO
    assert g["tipo"] == "shorts_cam" and g["jogo"] == [montagem.Y_JOGO, 1920] and g["cam"] == [y, y + h]
    assert y + h < montagem.Y_JOGO < g["titulo_y"] < 1000          # title strip on the seam
    graph, _ = montagem.filtergraph(1920, 1080, cam=(1500, 700, 380, 330))
    assert "crop=380:330:1500:700" in graph and "alphamerge" in graph   # rounded card
    assert f"crop=1080:{1920 - montagem.Y_JOGO}" in graph                # game fills the bottom
    assert "shortest=1" in graph                                         # ends with the game


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


def test_opening_flash_and_title_on_a_torn_red_strip(tmp_path):
    p = tmp_path / "a.ass"
    acabamento.gerar_ass(str(p), "A ROCKSTAR REALMENTE PENSOU EM TUDO", 13.5, {"tipo": "shorts_cam", "titulo_y": 846})
    s = p.read_text(encoding="utf-8")
    assert "PlayResX: 1080" in s and "PlayResY: 1920" in s
    assert ",Flash," in s and "\\fad(0,240)" in s                    # opening flash
    assert ",Faixa," in s and ",Papel," in s and acabamento.VERMELHO in s  # red strip on white torn paper
    assert "\\fscx55\\fscy55" in s and "\\fscx106" in s            # pops in
    faixa = [l for l in s.splitlines() if ",Faixa," in l][0]
    assert "\\pos(540,846)" in faixa and faixa.count(" l ") > 60      # jagged edges
    assert "0:00:13.50" in faixa                                        # stays the whole clip
    titulo = [l for l in s.splitlines() if ",Titulo," in l]
    assert [t.rsplit("}", 1)[1] for t in titulo] == ["A ROCKSTAR REALMENTE", "PENSOU EM TUDO"]


def test_the_strip_is_the_same_every_time_for_a_title(tmp_path):
    a, b = tmp_path / "a.ass", tmp_path / "b.ass"
    acabamento.gerar_ass(str(a), "OLHA O QUE ELE FEZ", 5)
    acabamento.gerar_ass(str(b), "OLHA O QUE ELE FEZ", 5)
    assert a.read_text(encoding="utf-8") == b.read_text(encoding="utf-8")


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
    assert montagem.ler(m)["tipo"] == "shorts"
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
