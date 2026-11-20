"""Running on the owner's Windows PC and opening it on the phone through
Tailscale (owner, 20-nov-2026)."""
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def test_windows_scripts_exist_and_keep_crlf():
    for nome in ("instalar.bat", "iniciar.bat", "parar.bat", "atualizar.bat", "celular.bat", "definir-senha.bat"):
        dados = (RAIZ / nome).read_bytes()
        assert dados.count(b"\r\n") == dados.count(b"\n"), f"{nome} precisa de CRLF"


def test_phone_link_is_private_tailscale_serve_not_funnel():
    s = (RAIZ / "celular.bat").read_text(encoding="utf-8")
    assert "serve --bg http://127.0.0.1:" in s
    assert "funnel" not in s.lower()            # funnel would put the panel on the open internet


def test_panel_accepts_the_tailscale_address():
    assert "'.ts.net'" in (RAIZ / "dashboard" / "vite.config.js").read_text(encoding="utf-8")


def test_busy_check_ignores_a_login_error():
    for nome in ("atualizar.bat", "parar.bat"):
        s = (RAIZ / nome).read_text(encoding="utf-8")
        assert 'findstr "jobs_active" >nul || set "FILA="' in s


def test_guide_covers_install_phone_and_backup():
    g = (RAIZ / "HOSPEDAR-NO-PC.md").read_text(encoding="utf-8")
    for trecho in ("instalar.bat", "celular.bat", "atualizar.bat", "Tailscale", "Backup", "Suspender: Nunca"):
        assert trecho in g
