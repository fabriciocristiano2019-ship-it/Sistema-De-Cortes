"""Narração de abertura (owner, 19-nov-2026): a voice reads the hook question
over the first seconds of the clip ("Olha o que ele fez aqui...").

Piper, free and offline, voice pt_BR "faber" (dataset CC0). Piper 1.5+ is
GPL-3.0, so it is run as a separate program (python -m piper), never
imported: the project keeps its own licence. .devcontainer/instalar_voz.sh
installs it in the codespace. Without it this returns None and the clip
ships without narration - never an error.
Off with GAMING_VOZ=0. Another voice: GAMING_VOZ_MODELO=/path/model.onnx.
"""
import importlib.util
import os
import subprocess
import sys

PASTA = os.path.join(os.path.expanduser("~"), ".openshorts", "vozes")
MODELO_PADRAO = os.path.join(PASTA, "pt_BR-faber-medium.onnx")


def modelo():
    return os.environ.get("GAMING_VOZ_MODELO") or MODELO_PADRAO


def disponivel():
    if os.environ.get("GAMING_VOZ", "1").strip() == "0":
        return False
    m = modelo()
    return (os.path.exists(m) and os.path.exists(m + ".json")
            and importlib.util.find_spec("piper") is not None)


def gerar(texto, saida):
    """Write the narration to `saida` (wav). Returns the path, or None."""
    texto = " ".join(str(texto or "").split())[:240]
    if not texto or not disponivel():
        return None
    try:
        r = subprocess.run([sys.executable, "-m", "piper", "-m", modelo(), "-f", saida, "--", texto],
                           capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"   ⚠️ Narração indisponível ({e}).")
        return None
    if r.returncode != 0 or not os.path.exists(saida) or os.path.getsize(saida) < 2000:
        print(f"   ⚠️ Narração falhou: {(r.stderr or '')[-200:]}")
        return None
    return saida
