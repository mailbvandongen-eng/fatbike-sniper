#!/bin/bash
# Haalt het speeltoestel op (Sketchfab, eigen lege map) en maakt er een spelmodel van.  tools/speel/bouw.sh
# "Low Poly Kids Playground" van 99.Miles, CC BY 4.0: https://sketchfab.com/3d-models/61c6f6f70db14bbb89ecdfa04b99bbc6
set -e
cd "$(dirname "$0")/../.."
UID_=61c6f6f70db14bbb89ecdfa04b99bbc6; TMP=/tmp/fbs/speel; mkdir -p assets/speel $TMP
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
[ -f /tmp/fbs/sf/$UID_/$UID_.glb ] || { mkdir -p /tmp/fbs/sf/$UID_; python3 -I /root/tools/homo-assets/scripts/sfget.py $UID_ /tmp/fbs/sf/$UID_; }
blender -b --python-use-system-env -P tools/speel/speel.py -- /tmp/fbs/sf/$UID_/$UID_.glb $TMP/toestel.glb 7 2>&1 | grep -E "MAAT|rror" || true
$GT prune $TMP/toestel.glb $TMP/a.glb >/dev/null
$GT webp $TMP/a.glb $TMP/b.glb --quality 85 >/dev/null
$GT meshopt $TMP/b.glb assets/speel/toestel.glb >/dev/null
ls -la assets/speel
