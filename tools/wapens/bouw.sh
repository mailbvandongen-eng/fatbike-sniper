#!/bin/bash
# Wapens uit de kast (Sketchfab, CC BY 4.0, elk in een eigen lege map): verkleinen en inpakken.  tools/wapens/bouw.sh
#  bazooka: "Low-Poly RPG-7" van TastyTony   https://sketchfab.com/3d-models/5243ac034391491f9a47f797ea212afe
#  mg:      "Low-Poly MG 42" van TastyTony   https://sketchfab.com/3d-models/141e542d223d483a88f04c5d1ae79872
#  vlam:    "Flamethrower" van bumstrum      https://sketchfab.com/3d-models/e7c1cdba89454ec291e8a5bcaff446ee
#  granaat: "Low-Poly F1 Hand Grenade" van TastyTony https://sketchfab.com/3d-models/dc4f4797dea64bcb9e6bc609a8fbfbaf
#  cobra:   "Dynamite stick" van bumstrum    https://sketchfab.com/3d-models/e245f8dd8c3342b594ed12aded20052e
#  geweer:  "Low-Poly Savage Arms Axis II" van TastyTony https://sketchfab.com/3d-models/69656b18a561476ebe777082909aed0a
#  pistool: "Low-Poly HK UCP" van TastyTony  https://sketchfab.com/3d-models/b3dd3b06abc34f6297ad00a860c598e5
#  knuppel: "Wooden Baseball Bat" van Planetrix23 https://sketchfab.com/3d-models/375ab0387df04e7b9e1bf3b04360e2b2
#  mes:     "Combat Knife" van San.Dro      https://sketchfab.com/3d-models/48e00da7aeb94530a5d0e0c3d58ca274
#  staf:    "Low Poly Wizard Staff 2.0" van roguecache https://sketchfab.com/3d-models/198eeed95bce41f38871baf200e9eb85
# Maat en richting worden bij het laden gezet (WAPENKAST in src/wapens.js).
set -e
cd "$(dirname "$0")/../.."
TMP=/tmp/fbs/wapens; mkdir -p assets/wapens $TMP
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
for paar in bazooka:5243ac034391491f9a47f797ea212afe mg:141e542d223d483a88f04c5d1ae79872 vlam:e7c1cdba89454ec291e8a5bcaff446ee granaat:dc4f4797dea64bcb9e6bc609a8fbfbaf cobra:e245f8dd8c3342b594ed12aded20052e geweer:69656b18a561476ebe777082909aed0a pistool:b3dd3b06abc34f6297ad00a860c598e5 knuppel:375ab0387df04e7b9e1bf3b04360e2b2 mes:48e00da7aeb94530a5d0e0c3d58ca274 staf:198eeed95bce41f38871baf200e9eb85; do
  IFS=: read naam uid <<< "$paar"
  [ -f /tmp/fbs/sf/$uid/$uid.glb ] || { mkdir -p /tmp/fbs/sf/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sf/$uid; }
  $GT metalrough /tmp/fbs/sf/$uid/$uid.glb $TMP/m.glb >/dev/null # oude materiaalsoort omzetten, anders raken de kleuren kwijt
  $GT prune $TMP/m.glb $TMP/a.glb >/dev/null; $GT resize $TMP/a.glb $TMP/b.glb --width 512 --height 512 >/dev/null
  $GT webp $TMP/b.glb $TMP/c.glb --quality 85 >/dev/null; $GT meshopt $TMP/c.glb assets/wapens/$naam.glb >/dev/null
done
ls -la assets/wapens
