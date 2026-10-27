#!/usr/bin/env bash
# Export the printable parts and a few pictures. Needs only Docker.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p stl renders build
run() { docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/w -w /w openscad/openscad:2021.01 "$@" 2>&1 | grep -E "ECHO|ERROR|WARNING" || true; }
run openscad -D 'part="front"' -o stl/pantry-scanner-front.stl pantry-scanner.scad
run openscad -D 'part="back"' -o stl/pantry-scanner-back.stl pantry-scanner.scad

# Pictures: each piece as a mesh in place, then a scene that only imports and colours them.
for p in front back panel pcb scanner radar; do run openscad -D "part=\"v_$p\"" -D '$fn=40' -o build/$p.stl pantry-scanner.scad; done
view() {  # name, eye, centre, extra
	python3 render.py "renders/$1.png" eye=$2 at=$3 $4 \
		build/front.stl:#e8e4dc build/back.stl:#c9c4ba build/panel.stl:#1b1d22 \
		build/pcb.stl:#1f6b3a build/scanner.stl:#c0392b build/radar.stl:#2e5cb8
}
view front 200,-230,90 53,22,-45 "" &
view bottom 170,-140,-230 53,22,-45 "" &
view inside -140,200,80 53,22,-45 noback &
view exploded -170,-230,130 53,45,-45 explode=50 &
wait
ls -la stl renders
