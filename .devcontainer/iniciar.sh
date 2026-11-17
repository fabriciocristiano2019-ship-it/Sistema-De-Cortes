#!/usr/bin/env bash
# Liga o servidor e o painel (roda sozinho a cada início do Codespace; também
# pode ser rodado à mão: bash .devcontainer/iniciar.sh).
cd "$(dirname "$0")/.."
mkdir -p .logs

if [ ! -x .venv/bin/uvicorn ] || [ ! -d dashboard/node_modules ]; then
  echo "A instalação ainda não terminou (ou falhou)."
  echo "Rode: bash .devcontainer/instalar.sh"
  exit 0
fi

# setsid + nohup: os processos ficam ligados mesmo depois que este script
# termina (sem isso o Codespaces os encerra junto com o comando de início).
# Every background process gets its own output files: none may keep this
# script's output open, or whoever reads it (the Codespaces start step) waits
# forever.
if ! pgrep -f "uvicorn app:app" >/dev/null; then
  setsid nohup .venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000 \
    > .logs/servidor.log 2>&1 < /dev/null &
fi
if ! pgrep -f "vite --port 5173" >/dev/null; then
  (cd dashboard && VITE_PROXY_TARGET=http://127.0.0.1:8000 exec setsid nohup npx vite --port 5173 --host 127.0.0.1) \
    > .logs/painel.log 2>&1 < /dev/null &
fi

echo "Conferindo o servidor e o painel (liga o que estiver desligado)..."
ok_api=""; ok_web=""
for _ in $(seq 1 60); do
  [ -z "$ok_api" ] && curl -s -m 3 -o /dev/null http://127.0.0.1:8000/health && ok_api=1
  [ -z "$ok_web" ] && curl -s -m 3 -o /dev/null http://127.0.0.1:5173/ && ok_web=1
  [ -n "$ok_api" ] && [ -n "$ok_web" ] && break
  sleep 2
done

if [ -n "$ok_api" ] && [ -n "$ok_web" ]; then
  echo ""
  echo "Pronto! Abra o painel:"
  if [ -n "${CODESPACE_NAME:-}" ]; then
    echo "  https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  else
    echo "  http://127.0.0.1:5173"
  fi
  echo "(ou: aba PORTAS -> porta 5173 -> icone do globo)"
else
  echo ""
  echo "O painel nao respondeu em 2 minutos. Veja os registros:"
  [ -z "$ok_api" ] && { echo "--- servidor (.logs/servidor.log) ---"; tail -n 15 .logs/servidor.log; }
  [ -z "$ok_web" ] && { echo "--- painel (.logs/painel.log) ---"; tail -n 15 .logs/painel.log; }
fi
