#!/bin/bash
# Modellen voor het vislevel (Sketchfab, CC BY 4.0, elk in een eigen lege map) → assets/vis/.  tools/vis/bouw.sh
#  hengel:             "Fishing Rod" van emelyarules         https://sketchfab.com/3d-models/86c77e3d23d341cd90245c21402f68b9
#  molen:              "Spinning Reel" van SiBeRiEIIIkA      https://sketchfab.com/3d-models/1761a2fbf3314970a7b12bc09d4d3098
#  karper (zwemt):     "Carp Fish" van huykhoi2407           https://sketchfab.com/3d-models/ef0c406d4ca84242a0464abecb7d7037
#  stoel:              "Camping Chair" van lpfeffer          https://sketchfab.com/3d-models/46b592f41c1f441ca19faadd2b4bb90a
#  blik:               "Beer can" van Arte Hexe              https://sketchfab.com/3d-models/b3257907af8248ab99cd27ff8c6a86d1
#  krat:               "Beer crate" van 3DDomino             https://sketchfab.com/3d-models/1e1e77108edb45308123a0ec81faf4d3
#  ambulance:          "Ambulance" van mk2design             https://sketchfab.com/3d-models/b78313c16c9d46a7a67643245cf278d2
# De maat en de richting zet het spel bij het laden (src/vissen.js); hier alleen kleiner maken en inpakken.
set -e
cd "$(dirname "$0")/../.."
TMP=/tmp/fbs/vis; mkdir -p assets/vis $TMP
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
for paar in hengel:86c77e3d23d341cd90245c21402f68b9:512 karper:ef0c406d4ca84242a0464abecb7d7037:512 stoel:46b592f41c1f441ca19faadd2b4bb90a:512 blik:b3257907af8248ab99cd27ff8c6a86d1:256 krat:1e1e77108edb45308123a0ec81faf4d3:256 molen:1761a2fbf3314970a7b12bc09d4d3098:256 ambulance:b78313c16c9d46a7a67643245cf278d2:1024; do
  IFS=: read naam uid tex <<< "$paar"
  [ -f /tmp/fbs/sf/$uid/scene.gltf ] || { echo "ontbreekt: /tmp/fbs/sf/$uid (eerst downloaden)"; exit 1; }
  $GT copy /tmp/fbs/sf/$uid/scene.gltf $TMP/a.glb >/dev/null
  $GT metalrough $TMP/a.glb $TMP/b.glb >/dev/null 2>&1 || cp $TMP/a.glb $TMP/b.glb
  $GT prune $TMP/b.glb $TMP/c.glb >/dev/null
  $GT resize $TMP/c.glb $TMP/d.glb --width $tex --height $tex >/dev/null
  $GT webp $TMP/d.glb $TMP/e.glb --quality 82 >/dev/null
  $GT meshopt $TMP/e.glb assets/vis/$naam.glb >/dev/null
done
ls -la assets/vis
