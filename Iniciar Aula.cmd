@echo off
setlocal
cd /d "%~dp0"

echo Aula Lans Studios
echo.

curl -s -o NUL --max-time 2 http://localhost:3000/login
if %errorlevel%==0 goto open

if not exist ".next\BUILD_ID" (
  echo Preparando la aplicacion por primera vez...
  call bun run build
  if errorlevel 1 goto error
)

echo Iniciando el servidor...
start "Aula Lans" /min cmd /c "bun run start"
timeout /t 5 >nul

:open
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app=http://localhost:3000
) else (
  start "" "http://localhost:3000"
)
goto end

:error
echo No se pudo preparar la aplicacion. Revisa que Bun este instalado.
pause

:end
endlocal
