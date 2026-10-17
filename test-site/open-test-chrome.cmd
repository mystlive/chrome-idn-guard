@echo off
setlocal
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto found
set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto found
set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto found
echo Chrome.exe not found. Please update this script's CHROME path.
pause
exit /b 1
:found
set "PROFILE=%LOCALAPPDATA%\DomainGuardianLabChromeProfile"
start "" "%CHROME%" --no-first-run --no-default-browser-check --user-data-dir="%PROFILE%" --host-resolver-rules="MAP paypal.test 127.0.0.1, MAP xn--pypal-4ve.test 127.0.0.1, MAP xn--e1argc3h.test 127.0.0.1, MAP xn--ggle-0nda.test 127.0.0.1, MAP xn--e1afmkfd.test 127.0.0.1" "http://paypal.test:8765/"
