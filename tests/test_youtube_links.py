"""Pasted YouTube links become the single video they point at."""
import pytest

from youtube_links import (CHANNEL_MSG, NO_VIDEO_MSG, PLAYLIST_MSG, LinkError,
                           normalize_video_url)

W = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.mark.parametrize("link", [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=UUabcdefghijklmnop&index=3",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&si=AbCdEf123",
    "https://youtu.be/dQw4w9WgXcQ?si=xyz",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share",
    "https://www.youtube.com/live/dQw4w9WgXcQ?si=1",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "youtube.com/watch?v=dQw4w9WgXcQ",
    "  https://youtu.be/dQw4w9WgXcQ  ",
    "https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&t=42s",
])
def test_video_links_become_the_canonical_watch_url(link):
    assert normalize_video_url(link) == W


@pytest.mark.parametrize("link,msg", [
    ("https://www.youtube.com/@CanalAutorizado", CHANNEL_MSG),
    ("https://www.youtube.com/@CanalAutorizado/videos", CHANNEL_MSG),
    ("https://www.youtube.com/channel/UC1234567890abcdefghij", CHANNEL_MSG),
    ("https://www.youtube.com/c/Canal", CHANNEL_MSG),
    ("https://www.youtube.com/playlist?list=PL1234567890", PLAYLIST_MSG),
    ("https://www.youtube.com/", NO_VIDEO_MSG),
    ("https://youtu.be/", NO_VIDEO_MSG),
])
def test_channel_and_playlist_links_say_what_to_copy(link, msg):
    with pytest.raises(LinkError) as e:
        normalize_video_url(link)
    assert str(e.value) == msg


def test_other_sites_pass_through():
    for u in ("https://example.com/video.mp4?x=1", "https://vimeo.com/123"):
        assert normalize_video_url(u) == u


def test_lookalike_hosts_are_not_youtube():
    u = "https://notyoutube.com/watch?v=dQw4w9WgXcQ"
    assert normalize_video_url(u) == u
