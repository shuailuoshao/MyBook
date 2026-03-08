@echo off
setlocal EnableDelayedExpansion
set "cmd=|"
for /F "tokens=*" %%a in ('"set ELECTRON_RUN 2>nul"') do set "cmd=!cmd!set %%a & "
cmd /c "set ELECTRON_RUN_AS_NODE=& cd /d D:\study_and_try\MyBook\MyBook & node_modules\electron\dist\electron.exe ."
