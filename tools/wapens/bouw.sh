#!/bin/bash
# Wapens uit de kast (Sketchfab, CC BY 4.0, elk in een eigen lege map): verkleinen en inpakken.  tools/wapens/bouw.sh
#  bazooka: "Low-Poly RPG-7" van TastyTony   https://sketchfab.com/3d-models/5243ac034391491f9a47f797ea212afe
#  mg:      "Low-Poly MG 42" van TastyTony   https://sketchfab.com/3d-models/141e542d223d483a88f04c5d1ae79872
#  vlam:    "Flamethrower" van bumstrum      https://sketchfab.com/3d-models/e7c1cdba89454ec291e8a5bcaff446ee
# Maat en richting worden bij het laden gezet (WAPENKAST in src/wapens.js).
set -e
cd "$(dirname "$0")/../.."
TMP=/tmp/fbs/wapens; mkdir -p assets/wapens $TMP
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
for paar in bazooka:5243ac034391491f9a47f797ea212afe mg:141e542d223d483a88f04c5d1ae79872 vlam:e7c1cdba89454ec291e8a5bcaff446ee; do
  IFS=: read naam uid <<< "$paar"
  [ -f /tmp/fbs/sf/$uid/$uid.glb ] || { mkdir -p /tmp/fbs/sf/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sf/$uid; }
  $GT prune /tmp/fbs/sf/$uid/$uid.glb $TMP/a.glb >/dev/null; $GT resize $TMP/a.glb $TMP/b.glb --width 512 --height 512 >/dev/null
  $GT webp $TMP/b.glb $TMP/c.glb --quality 85 >/dev/null; $GT meshopt $TMP/c.glb assets/wapens/$naam.glb >/dev/null
done
ls -la assets/wapens
