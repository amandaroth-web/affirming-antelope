#!/usr/bin/env bash
# Simulator capture + interaction helper for the booted iOS simulator.
# Usage: scripts/sim-capture.sh <shot|record|frames|gif|open|tap|swipe> ...
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/../docs/motion"
SCRATCH="${SIM_SCRATCH:-/private/tmp/claude-501/-Users-blake-Projects-personal-affirming-antelope/eb8d783a-c5ab-4dd6-a982-70cf109f0be6/scratchpad}"
SCHEME="antelope"
# Target device for every simctl/idb call. Default "booted" (the single booted sim);
# set SIM_UDID=<udid> to drive a specific simulator when more than one is booted.
# If SIM_UDID is unset and several sims are booted, "booted" is ambiguous, so fall back to
# the primary dev sim (iPhone 18 Pro, see docs/SIMULATOR.md) to keep existing callers on it.
SIM="${SIM_UDID:-booted}"
PRIMARY_UDID="CA4A5370-77E3-429B-AABA-05CD94AD9DB6"
if [ "$SIM" = "booted" ] && [ "$(xcrun simctl list devices booted | grep -c '(Booted)')" -gt 1 ]; then
  SIM="$PRIMARY_UDID"
fi
mkdir -p "$OUT"

# idb lives in the user pip bin dir; tap/swipe need it plus idb_companion.
# idb_companion: brew's formula needs newer Command Line Tools than installed, so the
# bottle is unpacked in ~/.local/idb-companion (see docs/SIMULATOR.md).
for d in "$HOME"/Library/Python/*/bin "$HOME/.local/idb-companion"; do [ -d "$d" ] && PATH="$d:$PATH"; done
export PATH

# Start idb_companion for the booted sim (once) and connect the idb client to it.
ensure_idb() {
  command -v idb >/dev/null && command -v idb_companion >/dev/null || { echo "idb/idb_companion missing; drive via 'open' deep links" >&2; exit 2; }
  if [ "$SIM" != "booted" ]; then udid="$SIM"; else
  udid="$(xcrun simctl list devices booted -j | python3 -I -c 'import json,sys; d=json.load(sys.stdin)["devices"]; print(next(x["udid"] for v in d.values() for x in v if x["state"]=="Booted"))')"
  fi
  # Each companion needs its own gRPC port; non-primary devices get 10883 unless IDB_PORT is set.
  port="${IDB_PORT:-$([ "$SIM" = "booted" ] || [ "$SIM" = "$PRIMARY_UDID" ] && echo 10882 || echo 10883)}"
  if ! idb list-targets 2>/dev/null | grep -q "$udid.*Booted.*localhost\|$udid.*companion"; then
    if ! pgrep -f "idb_companion --udid $udid" >/dev/null; then
      nohup idb_companion --udid "$udid" --grpc-port "$port" >"${TMPDIR:-/tmp}/idb_companion-$port.log" 2>&1 &
      sleep 2
    fi
    idb connect localhost "$port" >/dev/null 2>&1 || true
  fi
  IDB_UDID="$udid"
}

usage() {
  cat <<U
Env: SIM_UDID=<udid> targets a specific simulator (default: booted). METRO_PORT (default 8081).
     CROP=w:h:x:y (pixels) crops frames/gif to a region, e.g. just the mascot.
sim-capture.sh shot <name>              PNG of the booted sim -> docs/motion/<name>.png
sim-capture.sh record <name> <seconds>  H.264 video -> docs/motion/<name>.mp4
sim-capture.sh frames <name> <fps>      frames + contact sheet -> \$SCRATCH/frames/<name>{/,-sheet.jpg}
sim-capture.sh gif <name>               <=3MB GIF (30fps, 390px) next to the mp4
sim-capture.sh relaunch                 restart the app and re-attach it to Metro (localhost:8081)
sim-capture.sh open <path>              deep link: ${SCHEME}://<path> (e.g. drill/drill-oars-01)
sim-capture.sh tap <x> <y>              tap in points (logical px; 402x874 on iPhone 18 Pro)
sim-capture.sh swipe <x1> <y1> <x2> <y2> [duration_s]
U
  exit 1
}

need() { [ "${1:-}" ] || usage; }

# Wait until a file stops being a valid mp4 mid-write (moov atom present).
wait_finalized() {
  for _ in $(seq 1 50); do
    ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" >/dev/null 2>&1 && return 0
    sleep 0.2
  done
}

cmd="${1:-}"; shift || true
case "$cmd" in
  shot)
    need "${1:-}"
    xcrun simctl io "$SIM" screenshot --type=png "$OUT/$1.png" 2>/dev/null
    echo "$OUT/$1.png"
    ;;
  record)
    need "${1:-}"; need "${2:-}"
    f="$OUT/$1.mp4"
    logf="$(mktemp)"
    xcrun simctl io "$SIM" recordVideo --codec h264 --force "$f" >"$logf" 2>&1 &
    pid=$!
    for _ in $(seq 1 50); do grep -q "Recording started" "$logf" && break; sleep 0.1; done
    sleep "$2"
    kill -INT "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    rm -f "$logf"
    wait_finalized "$f"
    echo "$f ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")s)"
    ;;
  frames)
    need "${1:-}"; need "${2:-}"
    f="$OUT/$1.mp4"; [ -f "$f" ] || { echo "missing $f" >&2; exit 1; }
    d="$SCRATCH/frames/$1"; rm -rf "$d"; mkdir -p "$d"
    ffmpeg -v error -y -i "$f" -vf "${CROP:+crop=$CROP,}fps=$2" -q:v 3 "$d/f%04d.jpg"
    n="$(ls "$d" | wc -l | tr -d ' ')"
    sheet="$SCRATCH/frames/$1-sheet.jpg"
    # <=12 columns x rows; each tile 90px wide keeps the sheet small. Retry smaller if >80KB.
    cols=8; rows=$(( (n + cols - 1) / cols )); [ "$rows" -gt 0 ] || rows=1
    for w in 120 100 80 64 48; do
      ffmpeg -v error -y -i "$f" -vf "${CROP:+crop=$CROP,}fps=$2,scale=$w:-2,tile=${cols}x${rows}" -frames:v 1 -q:v 6 "$sheet"
      [ "$(stat -f%z "$sheet")" -le 81920 ] && break
    done
    echo "$n frames in $d"
    echo "sheet: $sheet ($(stat -f%z "$sheet") bytes, ${cols}x${rows} tiles, frame k = row-major index, t = k/$2 s)"
    ;;
  gif)
    need "${1:-}"
    f="$OUT/$1.mp4"; [ -f "$f" ] || { echo "missing $f" >&2; exit 1; }
    g="$OUT/$1.gif"
    for fps in 30 24 20 15; do
      for w in 390 320 270; do
        ffmpeg -v error -y -i "$f" -vf "${CROP:+crop=$CROP,}fps=$fps,scale=$w:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 "$g"
        [ "$(stat -f%z "$g")" -le 3145728 ] && { echo "$g ($(stat -f%z "$g") bytes, ${w}px @ ${fps}fps)"; exit 0; }
      done
    done
    echo "gif still >3MB: $g" >&2; exit 1
    ;;
  relaunch)
    b="com.anonymous.affirming-antelope"
    xcrun simctl terminate "$SIM" "$b" 2>/dev/null || true
    xcrun simctl launch "$SIM" "$b" >/dev/null
    sleep 5
    xcrun simctl openurl "$SIM" "$SCHEME://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT:-8081}"
    echo "relaunched $b -> Metro :${METRO_PORT:-8081}"
    ;;
  open)
    need "${1:-}"
    p="${1#/}"
    xcrun simctl openurl "$SIM" "$SCHEME://$p"
    echo "opened $SCHEME://$p"
    ;;
  tap)
    need "${1:-}"; need "${2:-}"
    ensure_idb
    idb ui tap --udid "$IDB_UDID" "$1" "$2"
    ;;
  swipe)
    need "${1:-}"; need "${4:-}"
    ensure_idb
    idb ui swipe --udid "$IDB_UDID" --duration "${5:-0.3}" "$1" "$2" "$3" "$4"
    ;;
  *) usage ;;
esac
