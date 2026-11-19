#!/usr/bin/env bash
# Narração dos cortes: Piper (voz neural grátis, roda no Codespace, sem
# internet depois de instalado) + a voz pt_BR "faber" (dados CC0).
# Piper 1.5+ é GPL-3.0: é instalado como programa à parte e chamado de fora
# (python -m piper); o código do projeto não muda de licença.
# Sem sucesso aqui, os cortes saem normalmente, só sem narração.
cd "$(dirname "$0")/.."
PASTA="$HOME/.openshorts/vozes"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium"
mkdir -p "$PASTA"
if ! .venv/bin/python -c "import piper" 2>/dev/null; then
  echo "    Instalando a narração (Piper)..."
  .venv/bin/pip install -q --no-cache-dir "piper-tts>=1.5,<2" || { echo "    Narração não instalada agora (tento de novo amanhã)."; exit 1; }
fi
for f in pt_BR-faber-medium.onnx pt_BR-faber-medium.onnx.json; do
  if [ ! -s "$PASTA/$f" ]; then
    curl -fsSL --retry 3 -o "$PASTA/$f.tmp" "$BASE/$f" && mv "$PASTA/$f.tmp" "$PASTA/$f" \
      || { rm -f "$PASTA/$f.tmp"; echo "    Não baixei a voz agora (tento de novo amanhã)."; exit 1; }
  fi
done
echo "    Narração pronta (voz pt_BR faber)."
