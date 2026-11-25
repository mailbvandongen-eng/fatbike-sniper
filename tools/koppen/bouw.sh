#!/bin/bash
# Dierenkoppen voor het kooigevecht (Sketchfab, CC BY 4.0, elk in een eigen lege map).  tools/koppen/bouw.sh
#  beer: "Bear head" van Wilka.io       https://sketchfab.com/3d-models/f513ca8443fb427ea2537a7c5e9fc472
#  wolf: "Wolf Head" van Hipsteralbatros https://sketchfab.com/3d-models/69c280a8e248431c9a4bc4b6cf1fd696
# De lijven (beer, wolf) komen uit tools/mensen/mensen.json en worden hier naar assets/dieren gezet.
set -e
cd "$(dirname "$0")/../.."
TMP=/tmp/fbs/koppen; mkdir -p assets/dieren $TMP
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
for paar in beer:f513ca8443fb427ea2537a7c5e9fc472:0.34 wolf:69c280a8e248431c9a4bc4b6cf1fd696:0.3; do
  IFS=: read naam uid breed <<< "$paar"
  [ -f /tmp/fbs/sf/$uid/$uid.glb ] || { mkdir -p /tmp/fbs/sf/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sf/$uid; }
  blender -b --python-use-system-env -P tools/koppen/kop.py -- /tmp/fbs/sf/$uid/$uid.glb $TMP/$naam.glb $breed 2>&1 | grep -E "MAAT|rror" || true
  $GT prune $TMP/$naam.glb $TMP/a.glb >/dev/null; $GT resize $TMP/a.glb $TMP/a2.glb --width 512 --height 512 >/dev/null
  $GT webp $TMP/a2.glb $TMP/b.glb --quality 85 >/dev/null; $GT meshopt $TMP/b.glb assets/dieren/kop_$naam.glb >/dev/null
  tools/mensen/bouw.sh $naam | grep -E "driehoeken|rror" || true
  mv assets/mensen/$naam.glb assets/dieren/lijf_$naam.glb
done
ls -la assets/dieren
