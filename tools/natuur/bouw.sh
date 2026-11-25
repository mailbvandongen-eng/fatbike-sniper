#!/bin/bash
# Bomen (Sketchfab, CC BY 4.0) en grondtexturen (Poly Haven, CC0).  tools/natuur/bouw.sh
#  boom: "Leaf Tree - PS1 Low Poly" van wersaus33  https://sketchfab.com/3d-models/d799c08100974e1ba352fcd646cb0694
#  kaal: "Dead Tree - PS1 Low Poly" van wersaus33  https://sketchfab.com/3d-models/de2611ba107f4c3c8c89bf516d5d9b6b
#  grond: leafy_grass, pavement_03 (klinkers), concrete_tiles (stoeptegels), asphalt_04 van polyhaven.com
# De texturen worden verkleind naar 512 px en zo geschaald dat ze gemiddeld halfgrijs zijn: het spel vermenigvuldigt
# er de kleur van de grond mee, zodat onze eigen kleuren blijven en de foto de structuur geeft.
set -e
cd "$(dirname "$0")/../.."
TMP=/tmp/fbs/natuur; mkdir -p assets/natuur assets/grond $TMP/tex
GT=/root/tools/homo-assets/node_modules/.bin/gltf-transform
for paar in boom:d799c08100974e1ba352fcd646cb0694 kaal:de2611ba107f4c3c8c89bf516d5d9b6b; do
  IFS=: read naam uid <<< "$paar"
  [ -f /tmp/fbs/sf/$uid/$uid.glb ] || { mkdir -p /tmp/fbs/sf/$uid; python3 -I /root/tools/homo-assets/scripts/sfget.py $uid /tmp/fbs/sf/$uid; }
  $GT prune /tmp/fbs/sf/$uid/$uid.glb $TMP/a.glb >/dev/null; $GT resize $TMP/a.glb $TMP/b.glb --width 512 --height 512 >/dev/null
  $GT meshopt $TMP/b.glb assets/natuur/$naam.glb >/dev/null
done
python3 -I - "$TMP/tex" assets/grond <<'PY'
import sys, json, urllib.request, os
import numpy as np
from PIL import Image
tmp, uit = sys.argv[1], sys.argv[2]
H = {'User-Agent': 'fatbike-sniper (bobvindt.nl)'}
for naam, bron in [('gras', 'leafy_grass'), ('klinker', 'pavement_03'), ('tegel', 'concrete_tiles'), ('asfalt', 'asphalt_04')]:
    f = f'{tmp}/{bron}.jpg'
    if not os.path.exists(f):
        d = json.loads(urllib.request.urlopen(urllib.request.Request('https://api.polyhaven.com/files/' + bron, headers=H), timeout=60).read())
        open(f, 'wb').write(urllib.request.urlopen(urllib.request.Request(d['Diffuse']['1k']['jpg']['url'], headers=H), timeout=120).read())
    a = np.asarray(Image.open(f).convert('RGB').resize((512, 512), Image.LANCZOS)).astype(np.float32) / 255
    a = a ** 2.2                                   # naar lineair licht
    a = a / a.reshape(-1, 3).mean(axis=0) * 0.5    # gemiddeld halfgrijs, per kleur
    if naam != 'gras': a = a * 0.5 + a.mean(axis=2, keepdims=True) * 0.5   # steen: minder eigen kleur, vooral structuur
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(f'{uit}/{naam}.jpg', quality=86)
    print(naam, os.path.getsize(f'{uit}/{naam}.jpg') // 1024, 'kB')
PY
ls -la assets/natuur
