#!/usr/bin/env bash
# Instala tudo dentro do Codespace (roda uma vez, quando ele é criado).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Programas do sistema (FFmpeg e bibliotecas de imagem)"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 fontconfig fonts-liberation
sudo rm -rf /var/lib/apt/lists/*

echo "==> Fontes das legendas"
sudo mkdir -p /usr/local/share/fonts/openshorts
sudo cp fonts/*.ttf /usr/local/share/fonts/openshorts/
sudo cp fonts/openshorts-fontmap.conf /etc/fonts/conf.d/60-openshorts.conf
sudo fc-cache -f >/dev/null

echo "==> Python (motor de IA só para processador: ~2 GB a menos que a versão com placa de vídeo)"
python -m venv .venv
. .venv/bin/activate
pip install --no-cache-dir --upgrade pip "setuptools>=84.1"
TORCH=$(grep -E '^torch==' requirements.txt)
VISION=$(grep -E '^torchvision==' requirements.txt)
if ! pip install --no-cache-dir "$TORCH" "$VISION" --index-url https://download.pytorch.org/whl/cpu; then
  echo "!! Versão leve indisponível; instalando a versão comum (ocupa ~2 GB a mais)."
  pip install --no-cache-dir "$TORCH" "$VISION"
fi
pip install --no-cache-dir -r requirements.txt
# Complementos oficiais do yt-dlp (scripts que o YouTube exige, rodados pelo Node.js).
pip install --no-cache-dir --upgrade "yt-dlp[default]"

echo "==> Painel (Node)"
(cd dashboard && npm ci --no-audit --no-fund)

echo "==> Configuração"
[ -f .env ] || cp .env.example .env
mkdir -p uploads output

echo "==> Pronto. O painel abre sozinho; se não abrir, veja a aba PORTAS (porta 5173)."
