"""Short titles (18-nov-2026): the owner found them generic and repetitive."""
from gaming.gemini_judge import clean_title
from gaming.moments import best_quote, build_copy


def test_the_players_best_line_becomes_the_title():
    t = build_copy("Free Fire", "vitoria", "Ganhamos! Vitória! Sobrou só eu e a gente ganhou! Booyah!", "x")
    title = t["video_title_for_youtube_short"]
    assert "sobrou só eu e a gente ganhou!" in title.lower() and title.endswith("🏆 | Free Fire")
    assert ", Sobrou" not in title                       # joined lines read as one sentence


def test_mumbling_is_not_a_title():
    assert best_quote("ah mano tipo é. né cara", "vitoria") is None
    assert best_quote("", "vitoria") is None


def test_titles_do_not_repeat_inside_a_job():
    used = set()
    titles = [build_copy("Free Fire", "headshot", "", f"seed-{i}", used)["video_title_for_youtube_short"] for i in range(5)]
    assert len(set(titles)) == 5


def test_filler_clips_never_claim_a_moment():
    t = build_copy("Free Fire", "extra", "Ganhei! Que kill!", "x")["video_title_for_youtube_short"]
    assert "Ganhei" not in t and "kill" not in t.lower()


def test_old_generic_titles_are_gone():
    seen = {build_copy("Free Fire", "extra", "", f"s{i}", set())["video_title_for_youtube_short"] for i in range(20)}
    assert not any(x in " ".join(seen) for x in ("Mais um trecho", "partida sem cortes", "Gameplay de"))


def test_gemini_title_is_cleaned():
    assert clean_title("#freefire \"CAPA NO ÚLTIMO TIRO 🎯🔥\"") == "Capa no último tiro 🔥"
    assert clean_title("Mesmo título", {"mesmo título"}) is None
    assert len(clean_title("palavra " * 20)) <= 70
