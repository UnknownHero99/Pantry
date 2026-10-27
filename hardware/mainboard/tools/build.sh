#!/usr/bin/env bash
# Rebuild the board from tools/design.py:
#   project rules -> schematic -> ERC -> netlist -> placed PCB -> routing -> DRC -> fab files
# Needs only Docker (the kicad/kicad image).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
DEMO=/usr/share/kicad/demos/stickhub/StickHub   # a stock KiCad 10 project: default settings and file version

tools/kicad.sh "
	set -e
	python3 tools/make_pro.py $DEMO.kicad_pro
	python3 tools/make_sch.py
	kicad-cli sch erc --exit-code-violations -o build/erc.rpt mainboard.kicad_sch
	kicad-cli sch export netlist -o build/board.net mainboard.kicad_sch >/dev/null
	V=\$(sed -n '2s/.*version \([0-9]*\).*/\1/p' $DEMO.kicad_pcb)
	printf '(kicad_pcb (version %s) (generator \"pantry\"))\n' \$V > mainboard.kicad_pcb
	python3 tools/make_pcb.py place build/board.net build/board.dsn
	python3 tools/route.py
	kicad-cli pcb drc --schematic-parity --severity-all -o build/drc.rpt mainboard.kicad_pcb >/dev/null || true
	grep -E '^\*\* Found' build/drc.rpt
" 2>&1 | grep --line-buffered -v ': Debug: '

# Fab files: Gerbers + drill (zip for JLCPCB), assembly BOM/CPL, schematic PDF, STEP, renders.
rm -rf fab && mkdir -p fab/gerbers
tools/kicad.sh "
	set -e
	kicad-cli pcb export gerbers --layers F.Cu,In1.Cu,In2.Cu,B.Cu,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,F.Mask,B.Mask,Edge.Cuts \
		--subtract-soldermask -o fab/gerbers/ mainboard.kicad_pcb >/dev/null
	kicad-cli pcb export drill --format excellon --excellon-separate-th --generate-map --map-format gerberx2 \
		-o fab/gerbers/ mainboard.kicad_pcb >/dev/null
	kicad-cli pcb export pos --format csv --units mm --side both -o build/pos.csv mainboard.kicad_pcb >/dev/null
	python3 tools/fab.py build/pos.csv
	kicad-cli sch export pdf -o fab/mainboard-schematic.pdf mainboard.kicad_sch >/dev/null
	kicad-cli pcb export step --subst-models --force -o fab/mainboard.step mainboard.kicad_pcb >/dev/null
	kicad-cli pcb render --side top --width 1600 --height 1100 --quality high --floor -o fab/render-top.png mainboard.kicad_pcb >/dev/null
	kicad-cli pcb render --side bottom --width 1600 --height 1100 --quality high --floor -o fab/render-bottom.png mainboard.kicad_pcb >/dev/null
" 2>&1 | grep --line-buffered -v ': Debug: '
(cd fab/gerbers && zip -q -r ../mainboard-gerbers.zip .)
ls fab
