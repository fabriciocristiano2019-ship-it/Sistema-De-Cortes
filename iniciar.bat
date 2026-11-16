@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title OpenShorts Gaming Edition

echo ============================================================
echo   INICIANDO OPENSHORTS GAMING EDITION...
echo ============================================================
echo.

if not exist "docker-compose.yml" (
    echo [ERRO] docker-compose.yml nao encontrado. Execute de dentro da pasta do projeto.
    goto :falha
)

docker info >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Docker Desktop nao esta em execucao.
    echo        Abra o Docker Desktop, aguarde "Engine running" e rode este arquivo de novo.
    goto :falha
)

if not exist ".env" if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [OK] Arquivo .env criado a partir de .env.example.
)
if not exist "output" mkdir "output"
if not exist "uploads" mkdir "uploads"

docker compose up -d
if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel iniciar os containers. Confira a mensagem acima.
    echo        Se for a primeira vez, rode instalar.bat antes.
    goto :falha
)

rem --- Portas reais publicadas pelo Docker (nao sao presumidas) -------------
call :porta frontend 5173 5175 PORTA_PAINEL
call :porta backend 8000 8000 PORTA_API

echo.
echo [INFO] Aguardando o servidor ficar pronto ^(pode levar ate 2 minutos^)...
set /a TENTATIVAS=0
where curl >nul 2>nul
if errorlevel 1 goto :sem_curl

:espera_api
curl -s -f -o nul "http://localhost:%PORTA_API%/health/ready"
if not errorlevel 1 goto :espera_painel
set /a TENTATIVAS+=1
if %TENTATIVAS% GEQ 90 goto :demorou
timeout /t 2 /nobreak >nul
goto :espera_api

:espera_painel
set /a TENTATIVAS=0
:espera_painel_loop
curl -s -f -o nul "http://localhost:%PORTA_PAINEL%/"
if not errorlevel 1 goto :pronto
set /a TENTATIVAS+=1
if %TENTATIVAS% GEQ 60 goto :demorou
timeout /t 2 /nobreak >nul
goto :espera_painel_loop

:sem_curl
timeout /t 25 /nobreak >nul
goto :pronto

:demorou
echo [AVISO] O servidor esta demorando mais que o normal para responder.
echo         O painel sera aberto assim mesmo; se nao carregar, aguarde um pouco
echo         e atualize a pagina. Para ver o que esta acontecendo:
echo             docker compose logs -f backend

:pronto
echo.
echo [OK] Painel:  http://localhost:%PORTA_PAINEL%/#app
echo [OK] API:     http://localhost:%PORTA_API%
echo.
echo Abrindo o painel no navegador...
start "" "http://localhost:%PORTA_PAINEL%/#app"
echo.
echo Para encerrar o sistema, execute parar.bat.
timeout /t 6 /nobreak >nul
exit /b 0

:falha
echo.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem :porta SERVICO PORTA_INTERNA PADRAO VARIAVEL
rem Le do Docker a porta realmente publicada ("0.0.0.0:5175" ou "[::]:5175").
rem ---------------------------------------------------------------------------
:porta
set "%4=%3"
for /f "tokens=1-4 delims=:" %%A in ('docker compose port %1 %2 2^>nul') do (
    if not "%%D"=="" (
        set "%4=%%D"
    ) else if not "%%C"=="" (
        set "%4=%%C"
    ) else if not "%%B"=="" (
        set "%4=%%B"
    )
)
exit /b 0
