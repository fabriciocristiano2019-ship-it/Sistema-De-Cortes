"""Gemini API key saved from the panel (Chaves e Integrações).

Before this, a key typed in the panel lived only in that browser (the PC and
the phone app each needed it) and the Codespaces secret needed a restart. Now
the panel can store it on the server: an owner-only file outside the
repository (~/.openshorts/gemini.key, 0600), loaded into GEMINI_API_KEY when
the server starts and right after it is saved, so every device and every new
job uses it. The key never goes back to the browser: only its last 4
characters. A GEMINI_API_KEY that already came from .env or a secret is kept
at start-up; saving in the panel replaces it for the running server.
"""
import os
import re
import tempfile

import httpx

ENV = "GEMINI_API_KEY"
# Only the basics: Google has more than one key format (AIza..., and newer
# ones like "AQ.Ab8..." with a dot), so the Google test decides if it works.
_FORMATO = re.compile(r"^[!-~]{20,300}$")      # printable ASCII, no spaces


def path():
    return os.environ.get("OPENSHORTS_GEMINI_KEY_FILE") or os.path.join(
        os.path.expanduser("~"), ".openshorts", "gemini.key")


class ChaveErro(ValueError):
    pass


def _ler():
    try:
        with open(path(), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def carregar_no_ambiente():
    """At start-up: use the saved key unless .env/secret already set one."""
    if os.environ.get(ENV, "").strip():
        return False
    chave = _ler()
    if chave:
        os.environ[ENV] = chave
        return True
    return False


def status():
    atual = os.environ.get(ENV, "").strip()
    if not atual:
        return {"configured": False, "source": None, "final": None}
    # The key in use is the panel's when it is the saved one; otherwise it came
    # from .env or a Codespaces secret.
    fonte = "painel" if atual == _ler() else "secret"
    return {"configured": True, "source": fonte, "final": atual[-4:]}


def salvar(chave):
    chave = (chave or "").strip()
    if not _FORMATO.match(chave):
        raise ChaveErro("Isso não parece uma chave do Gemini (tem espaço ou é curta demais). Copie a chave inteira do AI Studio.")
    destino = path()
    os.makedirs(os.path.dirname(destino), mode=0o700, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(destino), prefix=".gemini-")
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(chave + "\n")
        os.replace(tmp, destino)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    os.environ[ENV] = chave
    return status()


def remover():
    """Delete the saved key; the running server stops using it only if it was
    the panel's (a secret/.env key is not the panel's to drop)."""
    salva = _ler()
    try:
        os.remove(path())
    except FileNotFoundError:
        pass
    if salva and os.environ.get(ENV, "").strip() == salva:
        os.environ.pop(ENV, None)
    return status()


def explicar(status_code, corpo=""):
    """The Google answer in plain Portuguese."""
    texto = str(corpo or "")
    if status_code in (400, 401, 403) and ("API_KEY_INVALID" in texto or "API key not valid" in texto):
        return "Chave inválida. Confira se copiou a chave inteira no AI Studio."
    if status_code == 403:
        return "A chave não tem permissão para o Gemini (a API Generative Language pode estar desativada no projeto)."
    if status_code == 429:
        return "A cota gratuita acabou por agora. Tente mais tarde ou confira os limites no AI Studio."
    return f"O Google respondeu {status_code}. Tente de novo em instantes."


def testar(chave=None, client=None):
    """List models with the key (no generation quota used). {ok, mensagem}."""
    chave = (chave or os.environ.get(ENV, "")).strip()
    if not chave:
        return {"ok": False, "mensagem": "Nenhuma chave configurada."}
    c = client or httpx.Client(timeout=15)
    try:
        r = c.get("https://generativelanguage.googleapis.com/v1beta/models",
                  params={"pageSize": 50}, headers={"x-goog-api-key": chave})
    except httpx.HTTPError as e:
        return {"ok": False, "rede": True,
                "mensagem": f"Não foi possível falar com o Google ({type(e).__name__}). Confira a internet do codespace."}
    if r.status_code != 200:
        return {"ok": False, "mensagem": explicar(r.status_code, r.text[:500])}
    nomes = [m.get("name", "").split("/")[-1] for m in (r.json().get("models") or [])]
    flash = [n for n in nomes if "flash" in n]
    return {"ok": True, "mensagem": f"Chave funcionando: {len(nomes)} modelos disponíveis"
            + (f" (ex.: {flash[0]})." if flash else "."), "modelos": len(nomes)}
