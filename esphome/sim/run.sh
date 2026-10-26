#!/usr/bin/env bash
# Build the wall scanner's screens for this PC and open them in a window.
# Needs Docker and an X11 desktop. Scan with: esphome/sim/scan <barcode>
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -q -t pantry-esphome-sim sim >/dev/null
docker run --rm -v "$PWD":/config pantry-esphome-sim compile pantry-sim.yaml

# Run as you, so the X server lets the window in and the scan FIFO is yours.
exec docker run --rm -it --network host --user "$(id -u):$(id -g)" \
  -e DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v "$PWD":/config -w /config \
  --entrypoint .esphome/build/pantry-sim/.pioenvs/pantry-sim/program \
  pantry-esphome-sim
