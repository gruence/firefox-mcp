@echo off
REM This script registers the Native Messaging host with Firefox on Windows.

REM Get the absolute path to the directory containing this script.
set SCRIPT_DIR=%~dp0

REM Define the name of the host and the target manifest file.
set HOST_NAME=firefox_mcp_host
set WINDOWS_MANIFEST_NAME=manifest.windows.json

REM Generate the full, absolute Windows path to the manifest file.
set MANIFEST_PATH=%SCRIPT_DIR%%WINDOWS_MANIFEST_NAME%

REM Add/update the registry key for Firefox to find the host manifest.
REM The /ve flag sets the default value for the key.
REM The /f flag forces the overwrite of the existing key if it exists.
reg add "HKCU\Software\Mozilla\NativeMessagingHosts\%HOST_NAME%" /ve /d "%MANIFEST_PATH%" /f

if %errorlevel% equ 0 (
    echo Successfully registered firefox-mcp native messaging host for Windows.
    echo Please ensure Firefox is closed and restart it for the changes to take effect.
) else (
    echo Failed to register the native messaging host. Please try running as Administrator.
)

pause
