"""Game library: a JSON file that must survive bad input and never lose data."""
import json
import os

import pytest

from gaming import library, profiles


@pytest.fixture
def out(tmp_path):
    return str(tmp_path)


def test_first_run_seeds_one_example_per_category_family(out):
    games = library.load(out)
    assert len(games) == len(library.SEED_GAMES)
    assert {g["category"] for g in games} <= set(profiles.CATEGORIES)
    assert os.path.exists(os.path.join(out, "gaming", "games.json"))


def test_every_spec_category_exists():
    labels = {c["label"] for c in profiles.category_list()}
    assert labels == {"FPS e Battle Royale", "Mundo aberto", "RPG e MMORPG", "Terror", "Sobrevivência",
                      "Corrida", "Esportes", "Estratégia", "Simuladores", "Jogos casuais", "Outros"}


def test_any_game_can_be_registered_with_its_own_preferences(out):
    g = library.create(out, {"name": "  Hollow Knight  ", "category": "rpg", "aliases": "HK, hollow",
                             "preferences": {"clip_seconds": 45, "layout": "full", "nonsense": 1}})
    assert g["name"] == "Hollow Knight" and g["aliases"] == ["hk", "hollow"]
    assert g["preferences"]["clip_seconds"] == 45 and g["preferences"]["layout"] == "full"
    assert "nonsense" not in g["preferences"]
    assert g["analysis_profile"] == "rpg"
    assert library.get(out, g["id"])["name"] == "Hollow Knight"


def test_unknown_category_falls_back_to_other(out):
    assert library.create(out, {"name": "Jogo X", "category": "inexistente"})["category"] == "other"


def test_name_is_required_and_unique(out):
    with pytest.raises(ValueError):
        library.create(out, {"name": "   "})
    library.create(out, {"name": "Stardew Valley", "category": "casual"})
    with pytest.raises(ValueError):
        library.create(out, {"name": "stardew valley", "category": "casual"})


def test_update_merges_preferences_and_keeps_identity(out):
    g = library.create(out, {"name": "Valorant", "category": "fps_br"})
    up = library.update(out, g["id"], {"id": "hacked", "category": "strategy", "preferences": {"max_clips": 3}})
    assert up["id"] == g["id"] and up["category"] == "strategy"
    assert up["preferences"]["max_clips"] == 3
    assert up["preferences"]["clip_seconds"] == library.DEFAULT_PREFS["clip_seconds"]
    assert library.update(out, "does-not-exist", {"name": "x"}) is None


def test_delete_removes_the_game_and_its_cover_only(out):
    g = library.create(out, {"name": "Rocket League", "category": "sports"})
    cover = os.path.join(out, "gaming", "covers", f"{g['id']}.png")
    open(cover, "wb").write(b"x")
    job_dir = os.path.join(out, "job-1")
    os.makedirs(job_dir)
    clip = os.path.join(job_dir, "clip.mp4")
    open(clip, "wb").write(b"video")
    assert library.delete(out, g["id"]) is True
    assert not os.path.exists(cover)
    assert os.path.exists(clip), "produced clips belong to their jobs and must stay"
    assert library.delete(out, g["id"]) is False


def test_corrupt_library_is_kept_for_inspection_not_overwritten(out):
    library.load(out)
    path = os.path.join(out, "gaming", "games.json")
    open(path, "w").write("{ not json")
    assert library.load(out) == []
    kept = [f for f in os.listdir(os.path.dirname(path)) if ".corrupt-" in f]
    assert len(kept) == 1
    assert open(os.path.join(os.path.dirname(path), kept[0])).read() == "{ not json"


def test_write_is_atomic(out):
    library.create(out, {"name": "Celeste", "category": "casual"})
    folder = os.path.join(out, "gaming")
    assert not [f for f in os.listdir(folder) if f.endswith(".tmp")]
    assert json.load(open(os.path.join(folder, "games.json")))["version"] == 1


@pytest.mark.parametrize("filename,expected", [
    ("Free Fire gameplay teste.mp4", "Free Fire"),
    ("2026-11-10_minecraft_survival_ep3.mkv", "Minecraft"),
    ("GTA RP - fuga da policia.mp4", "GTA V"),
    ("cs2-ranked-mirage.mp4", "Counter-Strike 2"),
])
def test_game_is_identified_from_the_file_name(out, filename, expected):
    res = library.identify(out, filename)
    assert res["best"]["name"] == expected
    assert res["best"]["evidence"], "the guess must say why"


def test_unknown_game_is_reported_as_unknown_not_guessed(out):
    res = library.identify(out, "gravacao_2026_11_16.mp4")
    assert res["best"] is None and res["confidence"] == "nenhuma" and res["candidates"] == []


def test_short_alias_inside_another_word_does_not_match(out):
    # "ff" is a Free Fire alias; "buff" and "offline" must not trigger it.
    assert library.identify(out, "buff offline stuff.mp4")["best"] is None


def test_speech_can_identify_the_game(out):
    transcript = {"segments": [{"text": "bora jogar um Elden Ring hoje"}, {"text": "esse boss do Elden Ring é difícil"}]}
    res = library.identify(out, "video.mp4", transcript)
    assert res["best"]["name"] == "Elden Ring"
    assert any("citado" in e for e in res["best"]["evidence"])


def test_custom_game_is_identified_by_its_alias(out):
    library.create(out, {"name": "Lethal Company", "category": "horror", "aliases": ["lethal"]})
    assert library.identify(out, "lethal com a galera.mp4")["best"]["name"] == "Lethal Company"


def test_usage_stats_come_from_what_is_on_disk(out):
    g = library.create(out, {"name": "Among Us", "category": "casual"})
    job = os.path.join(out, "job-42")
    os.makedirs(job)
    json.dump({"gaming": {"game_id": g["id"]}, "shorts": [{}, {}, {}], "source_video": "job-42_partida.mp4"},
              open(os.path.join(job, "partida_metadata.json"), "w"))
    json.dump({"shorts": [{}]}, open(os.path.join(job, "outro_metadata.json"), "w"))   # not a gaming job
    st = library.stats(out)
    assert st[g["id"]]["videos"] == 1 and st[g["id"]]["clips"] == 3
    assert st[g["id"]]["history"][0]["source"] == "partida.mp4"
