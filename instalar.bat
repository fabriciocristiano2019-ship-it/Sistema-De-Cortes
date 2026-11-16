@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title OpenShorts Gaming Edition - Instalacao

echo ============================================================
echo   OPENSHORTS GAMING EDITION - INSTALACAO (WINDOWS + DOCKER)
echo ============================================================
echo.

rem --- 1. Pasta correta ---------------------------------------------------
if not exist "docker-compose.yml" (
    echo [ERRO] docker-compose.yml nao encontrado nesta pasta.
    echo        Execute o instalar.bat de dentro da pasta do projeto.
    goto :falha
)

rem --- 2. Docker Desktop instalado ---------------------------------------
where docker >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Docker Desktop nao encontrado.
    echo        Instale em https://www.docker.com/products/docker-desktop/
    echo        Depois de instalar, abra o Docker Desktop e rode este arquivo de novo.
    goto :falha
)
echo [OK] Docker encontrado.

rem --- 3. Docker Desktop em execucao -------------------------------------
docker info >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Docker Desktop esta instalado, mas nao esta em execucao.
    echo        Abra o Docker Desktop, aguarde aparecer "Engine running" e rode de novo.
    goto :falha
)
echo [OK] Docker em execucao.

rem --- 4. Docker Compose v2 ------------------------------------------------
docker compose version >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O comando "docker compose" nao esta disponivel.
    echo        Atualize o Docker Desktop para uma versao recente.
    goto :falha
)
echo [OK] Docker Compose disponivel.

rem --- 5. Portas usadas pelo sistema (lidas do docker-compose.yml) ---------
set "PORTA_OCUPADA="
for %%P in (8000 5175 3100) do (
    netstat -ano | findstr /R /C:":%%P .*LISTENING" >nul 2>nul
    if not errorlevel 1 (
        echo [AVISO] A porta %%P ja esta em uso por outro programa.
        set "PORTA_OCUPADA=1"
    )
)
if defined PORTA_OCUPADA (
    echo         Se for o proprio OpenShorts ja aberto, ignore este aviso.
    echo         Caso contrario, feche o programa que usa a porta antes de iniciar.
) else (
    echo [OK] Portas 8000, 5175 e 3100 livres.
)

rem --- 6. Espaco em disco ---------------------------------------------------
set "LIVRE_GB="
for /f "usebackq delims=" %%G in (`powershell -NoProfile -Command "[math]::Floor((Get-PSDrive -Name (Get-Location).Drive.Name).Free/1GB)" 2^>nul`) do set "LIVRE_GB=%%G"
if defined LIVRE_GB (
    if !LIVRE_GB! LSS 25 (
        echo [AVISO] Apenas !LIVRE_GB! GB livres neste disco. Recomendado: 25 GB ou mais
        echo         ^(imagens Docker ~12 GB + modelos + videos^).
    ) else (
        echo [OK] Espaco em disco: !LIVRE_GB! GB livres.
    )
)

rem --- 7. Arquivo .env -------------------------------------------------------
if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo [OK] Arquivo .env criado a partir de .env.example.
    ) else (
        echo [AVISO] .env.example nao encontrado; seguindo com as configuracoes padrao.
    )
) else (
    echo [OK] Arquivo .env ja existe ^(mantido como esta^).
)

rem --- 8. Pastas de dados ---------------------------------------------------
if not exist "output" mkdir "output"
if not exist "uploads" mkdir "uploads"
echo [OK] Pastas output e uploads prontas.

rem --- 9. Construcao das imagens --------------------------------------------
echo.
echo [INFO] Construindo as imagens Docker. Na primeira vez isso baixa varios GB
echo        e pode levar de 15 a 40 minutos, conforme a internet. Aguarde...
echo.
docker compose build
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao construir as imagens. Confira a mensagem acima.
    echo        Causas comuns: sem internet, pouco espaco em disco ou Docker sem memoria.
    goto :falha
)

echo.
echo ============================================================
echo [SUCESSO] Instalacao concluida.
echo           Execute iniciar.bat para abrir o sistema.
echo ============================================================
echo.
pause
exit /b 0

:falha
echo.
echo Instalacao NAO concluida.
pause
exit /b 1
