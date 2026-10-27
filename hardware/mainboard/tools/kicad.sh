#!/usr/bin/env bash
# Run a command in the KiCad 10 image with this project mounted at /work and
# KiCad's stock library tables installed, e.g.  tools/kicad.sh kicad-cli version
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/work -w /work kicad/kicad:10.0.7-full bash -c '
	mkdir -p ~/.config/kicad/10.0
	cp /usr/share/kicad/template/sym-lib-table /usr/share/kicad/template/fp-lib-table ~/.config/kicad/10.0/ 2>/dev/null || true
	'"$*"
