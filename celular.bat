@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title OpenShorts Gaming Edition - Abrir no celular

echo ============================================================
echo   ABRIR O PAINEL NO CELULAR (TAILSCALE)
echo ============================================================
echo.
echo Cria um link privado: so abre nos aparelhos conectados na
echo SUA conta do Tailscale (este PC e o seu celular). Basta rodar
echo uma vez; o link continua valendo depois de reiniciar o PC.
echo.

rem --- 1. Tailscale instalado -----------------------------------------------
set "TS="
where tailscale >nul 2>nul && set "TS=tailscale"
if not defined TS if exist "%ProgramFiles%\Tailscale\tailscale.exe" set "TS=%ProgramFiles%\Tailscale\tailscale.exe"
if not defined TS (
    echo [ERRO] Tailscale nao encontrado.
    echo        Instale em https://tailscale.com/download/windows
    echo        Entre com a sua conta e rode este arquivo de novo.
    goto :falha
)

rem --- 2. Conectado na conta --------------------------------------------------
"%TS%" status >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Tailscale esta instalado, mas este PC nao esta conectado.
    echo        Clique no icone do Tailscale perto do relogio e faca o login.
    goto :falha
)
echo [OK] Tailscale conectado.

rem --- 3. Painel ligado -------------------------------------------------------
call :porta frontend 5173 5175 PORTA_PAINEL
where curl >nul 2>nul
if not errorlevel 1 (
    curl -s -f -o nul "http://localhost:%PORTA_PAINEL%/"
    if errorlevel 1 (
        echo [AVISO] O painel nao respondeu em http://localhost:%PORTA_PAINEL%/
        echo         Rode iniciar.bat antes. O link sera criado assim mesmo.
    )
)

rem --- 4. Link privado com HTTPS ---------------------------------------------
echo.
echo [INFO] Criando o link. Se o Tailscale pedir para ativar HTTPS ou o
echo        "Serve", abra o endereco que ele mostrar, clique em ativar e
echo        espere: este arquivo continua sozinho.
echo.
"%TS%" serve --bg http://127.0.0.1:%PORTA_PAINEL%
if errorlevel 1 (
    echo.
    echo [ERRO] O Tailscale nao criou o link. Confira a mensagem acima.
    goto :falha
)

set "NOME="
for /f "usebackq delims=" %%N in (`powershell -NoProfile -Command "try { ((& '%TS%' status --json | Out-String | ConvertFrom-Json).Self.DNSName).TrimEnd('.') } catch { '' }"`) do set "NOME=%%N"

echo.
echo ============================================================
if defined NOME (
    echo   LINK DO CELULAR:  https://!NOME!/#app
) else (
    echo   Veja o link com o comando:  tailscale serve status
)
echo ============================================================
echo.
echo No celular: instale o app Tailscale, entre com a MESMA conta,
echo deixe ele ligado e abra o link acima. Salve nos favoritos ou
echo use "Adicionar a tela inicial" para virar um app.
echo.
echo Para desligar o link:  tailscale serve reset
echo.
pause
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
