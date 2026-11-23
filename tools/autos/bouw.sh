#!/bin/bash
# Haalt de automodellen op (Sketchfab, eigen lege map per model) en maakt er spelmodellen van.  tools/autos/bouw.sh [naam...]
set -e
cd "$(dirname "$0")/../.."
UIT=assets/autos; TMP=/tmp/fbs/auto; mkdir -p $UIT $TMP
namen=${@:-$(python3 -c "import json;print(' '.join(json.load(open('tools/autos/autos.json'))['autos']))")}
for n in $namen; do
  cfg=$(python3 -c "import json,sys;print(json.dumps(json.load(open('tools/autos/autos.json'))['autos'][sys.argv[1]]))" "$n")
  uid=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['uid'])" "$cfg")
  [ -f /tmp/fbs/sfa/$uid/$uid.glb ] || [ -f /tmp/fbs/sfb/$uid/$uid.glb ] || { mkdir -p /tmp/fbs/sfa/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sfa/$uid; }
  bron=/tmp/fbs/sfa/$uid/$uid.glb; [ -f $bron ] || bron=/tmp/fbs/sfb/$uid/$uid.glb
  blender -b --python-use-system-env -P tools/autos/auto.py -- $bron $UIT/$n.glb $UIT/$n.json "$cfg" $TMP/$n.png 2>&1 | grep -E "WIELEN|driehoeken|MATERIALEN|META|rror" || true
done
ls -la $UIT
