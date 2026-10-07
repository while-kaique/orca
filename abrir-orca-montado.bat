@echo off
rem Abre o fork do Orca no modo MONTADO: monta o app uma vez (~10 s) e roda sem recarregar
rem quando o codigo muda. Para editar o Orca com recarga automatica, use dev-orca.bat.
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
set "pnpm_config_virtual_store_dir_max_length=30"
set "ORCA_DEV_USER_DATA_PATH=%APPDATA%\orca-fork"
set "ORCA_CLOUD_API_URL=https://login.onorca.dev"
set "ORCA_CLOUD_CLIENT_ID=orca-desktop"
set "ELECTRON_RUN_AS_NODE="
if not exist "%ORCA_DEV_USER_DATA_PATH%" (
  robocopy "%APPDATA%\orca\profiles" "%ORCA_DEV_USER_DATA_PATH%\profiles" /E /NFL /NDL /NJH /NJS >nul
  copy /Y "%APPDATA%\orca\orca-profile-index.json" "%ORCA_DEV_USER_DATA_PATH%\" >nul
)
set "ORCA_LOG_DIR=%ORCA_DEV_USER_DATA_PATH%\logs"
if not exist "%ORCA_LOG_DIR%" mkdir "%ORCA_LOG_DIR%"
rem Uma abertura por vez: duas montagens ao mesmo tempo disputam os mesmos arquivos e
rem sobrecarregam o PC (travou o Windows em 29/09/2026). A trava vale so enquanto monta.
set "LOCK=%ORCA_LOG_DIR%\abertura.lock"
set "PREPARED="
set "PREP_FAILED="
2>nul (9>"%LOCK%" call :prepare)
if not defined PREPARED (
  echo %DATE% %TIME% atalho ignorado: outra abertura do fork ainda esta montando>> "%ORCA_LOG_DIR%\aberturas-ignoradas.log"
  exit /b 0
)
if defined PREP_FAILED goto dev
call "%~dp0node_modules\.bin\electron-vite.cmd" preview --skipBuild >> "%LOG%" 2>&1
if errorlevel 1 goto dev
exit /b 0

:prepare
set "PREPARED=1"
if exist "%ORCA_LOG_DIR%\main-console.log" move /Y "%ORCA_LOG_DIR%\main-console.log" "%ORCA_LOG_DIR%\main-console.anterior.log" >nul 2>&1
rem Se um processo antigo do fork ainda segura o log, grava num arquivo novo em vez de falhar.
set "LOG=%ORCA_LOG_DIR%\main-console.log"
if exist "%LOG%" set "LOG=%ORCA_LOG_DIR%\main-console-%RANDOM%.log"
cd /d "%~dp0"
echo === modo montado, aberto em %DATE% %TIME% ===>> "%LOG%"
set "BUILD_KEY=%~dp0out\.pc-desk-build-key"
rem So monta se o codigo mudou desde a ultima montagem (economiza ~10 s).
node config\scripts\pc-desk-build-key.mjs "%BUILD_KEY%"
if not errorlevel 1 goto ensure
if exist "%BUILD_KEY%" del "%BUILD_KEY%"
rem Apaga a montagem antiga: se o build nem rodar (ex.: log preso), a chave nao e gravada.
if exist "%~dp0out\main\index.js" del "%~dp0out\main\index.js"
call node config\scripts\run-electron-vite-build.mjs >> "%LOG%" 2>&1
if errorlevel 1 (set "PREP_FAILED=1" & exit /b 1)
if not exist "%~dp0out\main\index.js" (set "PREP_FAILED=1" & exit /b 1)
node config\scripts\pc-desk-build-key.mjs "%BUILD_KEY%" --save
:ensure
call node config\scripts\ensure-native-runtime.mjs --runtime=electron >> "%LOG%" 2>&1
exit /b 0

:dev
rem Se montar ou abrir falhar, cai no modo dev para voce nunca ficar sem o app.
echo === falhou (errorlevel %ERRORLEVEL%), abrindo em modo dev %TIME% ===>> "%LOG%"
call "%~dp0dev-orca.bat"
