#!/bin/sh
# použitie: test/shot.sh <url> <výstup.png> [šírka] [výška] [čas_ms]
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --hide-scrollbars --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=${5:-3000} --user-data-dir="C:\Users\PC1\AppData\Local\Temp\claude\edgeprof" --screenshot="$(cygpath -aw "$2")" --window-size=${3:-1200},${4:-1000} "$1" >/dev/null 2>&1
