@echo off
cd /d "%~dp0"
if not exist node_modules\bun\bin\bun.exe (
  call npm.cmd ci
  if errorlevel 1 goto failure
)
call npm.cmd run setup
if errorlevel 1 goto failure
call npm.cmd run build
if errorlevel 1 goto failure
call npm.cmd run launch
goto end
:failure
echo SKYBRIDGE could not start. Copy the error above without any secrets.
pause
:end
