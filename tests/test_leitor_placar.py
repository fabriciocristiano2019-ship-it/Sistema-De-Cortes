"""Leitor do placar: a game notice (kill feed, banner) is new text in ONE
place while the rest of the picture stays; a camera pan is not one."""
import numpy as np

from gaming import signals


def _serie(t=60):
    dens = np.full((t, len(signals.HUD_REGIOES)), 0.05)
    total = np.full(t, 0.05)
    rng = np.random.default_rng(1)
    dens += rng.normal(0, 0.004, dens.shape)
    total += rng.normal(0, 0.002, t)
    return dens, total


def test_a_banner_that_stays_is_a_notice():
    dens, total = _serie()
    dens[40:46, 3] += 0.20          # "VITÓRIA" in the centre for 3 s
    s = signals.hud_score(dens, total)
    assert int(np.argmax(s)) in range(40, 46) and s.max() > 4


def test_a_camera_pan_is_not_a_notice():
    dens, total = _serie()
    dens[40:46, :] += 0.20          # everything changed at once
    total[40:46] += 0.20
    assert signals.hud_score(dens, total).max() < 2


def test_a_one_frame_blip_is_ignored():
    dens, total = _serie()
    dens[40, 1] += 0.30             # half a second only
    assert signals.hud_score(dens, total)[38:43].max() < 2


def test_no_picture_no_signal():
    assert len(signals.hud_score(np.zeros((0, 4)), np.zeros(0))) == 0


def test_the_notice_counts_as_evidence_with_another_source():
    from gaming import moments
    assert moments.has_evidence(["hud", "audio_peak"], audio_usable=True)
    assert not moments.has_evidence(["hud"], audio_usable=True)   # alone it could be a menu
