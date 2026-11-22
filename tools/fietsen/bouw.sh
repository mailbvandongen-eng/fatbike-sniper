#!/bin/bash
# Haalt de fietsmodellen op (Sketchfab, eigen lege map per model) en maakt er spelmodellen van.  tools/fietsen/bouw.sh [naam...]
set -e
cd "$(dirname "$0")/../.."
UIT=assets/fietsen; TMP=/tmp/fbs/fiets; mkdir -p $UIT $TMP
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
namen=${@:-$(python3 -c "import json;print(' '.join(json.load(open('tools/fietsen/fietsen.json'))['fietsen']))")}
for n in $namen; do
  cfg=$(python3 -c "import json,sys;print(json.dumps(json.load(open('tools/fietsen/fietsen.json'))['fietsen'][sys.argv[1]]))" "$n")
  uid=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['uid'])" "$cfg")
  [ -f /tmp/fbs/sf/$uid/$uid.glb ] || { mkdir -p /tmp/fbs/sf/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sf/$uid; }
  blender -b --python-use-system-env -P tools/fietsen/fiets.py -- /tmp/fbs/sf/$uid/$uid.glb $TMP/$n.glb $UIT/$n.json "$cfg" 2>&1 | grep -E "verfijnd|assen|wielpunten|driehoeken|rror" || true
  # geen meshopt: het spel voegt stilstaande fietsen samen en heeft dan gewone (niet gecomprimeerde) getallen nodig
  cp $TMP/$n.glb $UIT/$n.glb
done
ls -la $UIT
