@echo off
setlocal enabledelayedexpansion

set "CMD=%~1"
set "ARG1=%~2"
set "ARG2=%~3"

if /I "!CMD!"=="PING" (
    echo PONG
    exit /b 0
)

if /I "!CMD!"=="FLUSHDB" (
    curl -s http://localhost:8080/flush > NUL
    echo OK
    exit /b 0
)

if /I "!CMD!"=="KEYS" (
    for /f "delims=" %%i in ('node -e "fetch('http://localhost:8080/inspect').then(r=>r.json()).then(d=>d.keys.forEach(k=>console.log(k[0])))"') do echo %%i
    exit /b 0
)

if /I "!CMD!"=="TTL" (
    for /f "delims=" %%i in ('node -e "fetch('http://localhost:8080/inspect').then(r=>r.json()).then(d=>{const kt=d.ttls.find(t=>t[0]==='!ARG1!'); if(kt) { const ttl=Math.ceil((kt[1]-d.now)/1000); console.log(ttl>0?ttl:-2); } else { console.log(-2); } })"') do echo %%i
    exit /b 0
)

echo Unknown command
exit /b 1
