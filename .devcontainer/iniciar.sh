#!/usr/bin/env bash
# Liga o servidor e o painel (roda sozinho a cada início do Codespace; também
# pode ser rodado à mão: bash .devcontainer/iniciar.sh).
cd "$(dirname "$0")/.."
mkdir -p .logs

# The codespace runs this twice on open (postStart and postAttach): one at a
# time, or both could update and stop the servers the other just started. The
# copy that atualizar.sh calls back already runs under its parent's lock. The
# servers started below must not inherit fd 9 (9>&-): they outlive this
# script, and a lock held by them would make every later start wait forever.
if [ -z "${OPENSHORTS_ATUALIZANDO:-}" ]; then
  exec 9>.logs/.iniciar.lock
  flock -n 9 || { echo "Outra inicialização em andamento; aguardando ela terminar..."; flock 9; }
fi

if [ ! -x .venv/bin/uvicorn ] || [ ! -d dashboard/node_modules ]; then
  echo "A instalação ainda não terminou (ou falhou)."
  echo "Rode: bash .devcontainer/instalar.sh"
  exit 0
fi

# Atualização automática: ao ligar ou abrir o codespace, se o GitHub tiver uma
# versão mais nova, atualiza antes de ligar (atualizar.sh). Nunca no meio de um
# processamento: com vídeo na fila, só avisa. Desligar: OPENSHORTS_AUTO_UPDATE=0.
# OPENSHORTS_ATUALIZANDO evita repetir a checagem quando atualizar.sh chama este
# script de volta.
if [ "${OPENSHORTS_AUTO_UPDATE:-1}" = "1" ] && [ -z "${OPENSHORTS_ATUALIZANDO:-}" ]; then
  ramo="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  { [ -z "$ramo" ] || [ "$ramo" = "HEAD" ]; } && ramo=main
  if timeout 20 git fetch -q origin "$ramo" 2>/dev/null \
     && [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$ramo")" ] \
     && git merge-base --is-ancestor HEAD "origin/$ramo" 2>/dev/null; then
    # A video being uploaded is not a job yet: restarting now would cut the
    # upload and leave the page dark. Parts land in uploads/pending_*.
    if find uploads -maxdepth 1 -name 'pending_*' -mmin -2 2>/dev/null | grep -q .; then
      echo "Versão nova no GitHub. Há vídeo sendo enviado: atualizo depois."
      echo "Quando terminar, rode: bash .devcontainer/atualizar.sh"
    elif curl -s -m 3 http://127.0.0.1:8000/api/gaming/system 2>/dev/null | python3 -c \
        'import json,sys; d=json.load(sys.stdin); sys.exit(0 if (d.get("jobs_active") or 0) + (d.get("jobs_queued") or 0) else 1)' 2>/dev/null; then
      echo "Versão nova no GitHub. Há vídeo em processamento: atualizo depois."
      echo "Quando terminar, rode: bash .devcontainer/atualizar.sh"
    else
      echo "Versão nova encontrada no GitHub: atualizando antes de ligar..."
      # The newest updater, even when this checkout predates it.
      if git checkout "origin/$ramo" -- .devcontainer/atualizar.sh 2>/dev/null; then
        OPENSHORTS_ATUALIZANDO=1 exec bash .devcontainer/atualizar.sh
      fi
      echo "Não consegui atualizar sozinho; ligando a versão atual."
    fi
  fi
fi

# Guarda e disco no Codespaces: cortes por 7 dias (o padrão do servidor é 24 h)
# e limites que cabem no disco e na cota grátis (o padrão, 25 + 15 GB, passa
# dos ~32 GB do Codespaces). Os mais antigos saem primeiro. Um valor no .env
# continua valendo.
for par in JOB_RETENTION_SECONDS=604800 OUTPUT_MAX_GB=10 UPLOADS_MAX_GB=4; do
  nome="${par%%=*}"
  if ! grep -qs "^${nome}=" .env && [ -z "${!nome:-}" ]; then export "$par"; fi
done

# setsid + nohup: os processos ficam ligados mesmo depois que este script
# termina (sem isso o Codespaces os encerra junto com o comando de início).
# Every background process gets its own output files: none may keep this
# script's output open, or whoever reads it (the Codespaces start step) waits
# forever.
if ! pgrep -f "uvicorn app:app" >/dev/null; then
  setsid nohup .venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000 \
    > .logs/servidor.log 2>&1 < /dev/null 9>&- &
fi
# The panel is served already built (vite preview): one small bundle instead
# of the development server, which reloads the page on its own when its
# connection drops (as during a big upload through the codespace tunnel). It
# is rebuilt only when the code changed; if the build fails, the development
# server is used as before. OPENSHORTS_PAINEL_DEV=1 forces development mode.
versao_painel() { printf '%s %s' "$(git rev-parse HEAD 2>/dev/null)" "$(git status --porcelain -- dashboard 2>/dev/null | md5sum | cut -c1-8)"; }
painel_montado() {
  [ -f dashboard/dist/index.html ] && [ "$(cat dashboard/dist/.versao 2>/dev/null)" = "$(versao_painel)" ] && return 0
  echo "Montando o painel (uns 20 segundos)..."
  (cd dashboard && npx vite build) > .logs/build.log 2>&1 && versao_painel > dashboard/dist/.versao
}
if ! pgrep -f "vite.*--port 5173" >/dev/null; then
  if [ "${OPENSHORTS_PAINEL_DEV:-0}" != "1" ] && painel_montado; then
    (cd dashboard && VITE_PROXY_TARGET=http://127.0.0.1:8000 exec setsid nohup npx vite preview --port 5173 --host 127.0.0.1 --strictPort) \
      > .logs/painel.log 2>&1 < /dev/null 9>&- &
  else
    [ "${OPENSHORTS_PAINEL_DEV:-0}" != "1" ] && echo "A montagem falhou (.logs/build.log): usando o modo de desenvolvimento."
    (cd dashboard && VITE_PROXY_TARGET=http://127.0.0.1:8000 exec setsid nohup npx vite --port 5173 --host 127.0.0.1) \
      > .logs/painel.log 2>&1 < /dev/null 9>&- &
  fi
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
