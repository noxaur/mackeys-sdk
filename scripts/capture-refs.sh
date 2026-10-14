#!/bin/sh
# Captures web reference screenshots from the React demo (pnpm --dir examples/react-demo dev must run on port 5173).
# Native ports compare their renders with these files.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$(cd "$(dirname "$0")/.." && pwd)/spec/reference/screens"
mkdir -p "$OUT"
shot() { # name width height query
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size="$2,$3" --virtual-time-budget=3000 \
    --screenshot="$OUT/$1.png" "http://localhost:5173/?bare=1&scale=1&$4" >/dev/null 2>&1
  echo "$OUT/$1.png"
}
shot macbook-pro-space-black-us 1300 1200 "finish=pro-space-black&layout=en-us&part=macbook"
shot macbook-air-starlight-de 1300 1200 "finish=air-starlight&layout=de&part=macbook"
shot macbook-neo-blush-ja 1300 1200 "finish=neo-blush&layout=ja&part=macbook"
shot keyboard-pro-space-black-dark-lit-pressed 1100 520 "finish=pro-space-black&layout=en-us&part=keyboard&on=1&level=16&room=dark&press=KeyA,ShiftLeft"
shot keyboard-air-midnight-lit-ko 1100 520 "finish=air-midnight&layout=ko&part=keyboard&on=1&level=12"
shot keyboard-imac-blue-ru 1000 460 "finish=imac-blue&layout=ru&part=keyboard"
shot keyboard-imac-green-fr 1000 460 "finish=imac-green&layout=fr&part=keyboard"
shot trackpad-pro-silver 500 330 "finish=pro-silver&part=trackpad"
