#!/bin/bash
# Haalt de automodellen op (Sketchfab, eigen lege map per model) en maakt er spelmodellen van.  tools/autos/bouw.sh [naam...]
set -e
cd "$(dirname "$0")/../.."
UIT=assets/autos; TMP=/tmp/fbs/auto; mkdir -p $UIT $TMP
namen=${@:-$(python3 -c "import json;print(' '.join(json.load(open('tools/autos/autos.json'))['autos']))")}
for n in $namen; do
  cfg=$(python3 -c "import json,sys;print(json.dumps(json.load(open('tools/autos/autos.json'))['autos'][sys.argv[1]]))" "$n")
  uid=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['uid'])" "$cfg")
  bron=$(ls /tmp/fbs/sf?/$uid/$uid.glb 2>/dev/null | head -1); [ -n "$bron" ] || { mkdir -p /tmp/fbs/sfa/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sfa/$uid; }
  bron=$(ls /tmp/fbs/sf?/$uid/$uid.glb | head -1)
  blender -b --python-use-system-env -P tools/autos/auto.py -- $bron $TMP/$n.glb $UIT/$n.json "$cfg" $TMP/$n.png 2>&1 | grep -E "WIELEN|driehoeken|MATERIALEN|META|rror" || true
  /root/tools/homo-assets/node_modules/.bin/gltf-transform meshopt $TMP/$n.glb $UIT/$n.glb >/dev/null
done
ls -la $UIT
