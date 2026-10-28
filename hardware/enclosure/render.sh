#!/usr/bin/env bash
# Export the printable parts and a few pictures. Needs only Docker.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p stl renders build
run() { docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/w -w /w openscad/openscad:2021.01 "$@" 2>&1 | grep -E "ECHO|ERROR|WARNING" || true; }
run openscad -D 'part="shell"' -o stl/pantry-scanner-shell.stl pantry-scanner.scad &
run openscad -D 'part="back"' -o stl/pantry-scanner-back.stl pantry-scanner.scad &
run openscad -D 'board="mainboard"' -D 'part="shell"' -o stl/mainboard-shell.stl pantry-scanner.scad &
run openscad -D 'board="mainboard"' -D 'part="back"' -o stl/mainboard-back.stl pantry-scanner.scad &
wait

# Pictures: each piece as a mesh in place, then a scene that only imports and colours them.
for p in shell back panel pcb scanner; do run openscad -D "part=\"v_$p\"" -D '$fn=40' -o build/$p.stl pantry-scanner.scad; done
view() {  # name, eye, centre, extra
	python3 render.py "renders/$1.png" eye=$2 at=$3 $4 \
		build/shell.stl:#e8e4dc build/back.stl:#c9c4ba build/panel.stl:#1b1d22 \
		build/pcb.stl:#1f6b3a build/scanner.stl:#c0392b
}
view front 140,-260,120 0,-30,70 "" &
view side 260,-120,90 0,-30,70 "" &
view below 120,-190,-120 0,-30,45 "" &
view inside -150,140,150 0,-25,70 noback &
wait
view exploded -170,-200,150 0,-10,70 explode=40
ls -la stl renders
