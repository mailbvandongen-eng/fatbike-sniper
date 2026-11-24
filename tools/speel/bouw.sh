#!/bin/bash
# Haalt de speeltoestellen op (Sketchfab, elk in een eigen lege map) en maakt er spelmodellen van.  tools/speel/bouw.sh
#  toestel: "Playground" van JanStano, CC BY 4.0: https://sketchfab.com/3d-models/965816aa987644c59de6eb9e844619ae
set -e
cd "$(dirname "$0")/../.."
TMP=/tmp/fbs/speel; mkdir -p assets/speel $TMP
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
for paar in toestel:965816aa987644c59de6eb9e844619ae:4.0; do
  IFS=: read naam uid lengte <<< "$paar"
  [ -f /tmp/fbs/sf/$uid/$uid.glb ] || { mkdir -p /tmp/fbs/sf/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sf/$uid; }
  blender -b --python-use-system-env -P tools/speel/speel.py -- /tmp/fbs/sf/$uid/$uid.glb $TMP/$naam.glb $lengte 2>&1 | grep -E "MAAT|rror" || true
  $GT prune $TMP/$naam.glb $TMP/a.glb >/dev/null
  $GT resize $TMP/a.glb $TMP/a2.glb --width 1024 --height 1024 >/dev/null
  $GT webp $TMP/a2.glb $TMP/b.glb --quality 85 >/dev/null
  $GT meshopt $TMP/b.glb assets/speel/$naam.glb >/dev/null
done
ls -la assets/speel
