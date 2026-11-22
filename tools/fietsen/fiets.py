# blender -b --python-use-system-env -P tools/fietsen/fiets.py -- <in.glb> <uit.glb> <uit.json> '<json>'
# Maakt van een gedownload fietsmodel (Sketchfab, CC BY) een spelmodel:
#  - echte maat (naar de wielstraal), voorkant naar -Y (wordt +z in three), grond op 0, midden tussen de wielen op 0
#  - wielen los (draaipunt op de as), zodat ze kunnen draaien
#  - kleuren per punt: band = rubber, binnen de band = metaal, zadel, en het frame in "tover-magenta" (#ff00ff);
#    het spel vervangt die magenta door de framekleur van elke fiets
#  - minder driehoeken, en de maten (wielen, handvatten, zadel) in een json voor het spel
# json: {"bron": {...}, "straal": wielstraal m, "doel": driehoeken, "metaal": "#hex", "band": "#hex", "frameMetaal": false}
import bpy, bmesh, sys, json, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]
IN, OUT, META = a[0], a[1], a[2]
C = json.loads(a[3])
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=IN)
ms = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(ms) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
for o in list(bpy.data.objects):
    if o != ob: bpy.data.objects.remove(o)
me = ob.data
for m in list(me.materials): pass
me.materials.clear()
V = [v.co.copy() for v in me.vertices]

# bron: de wielen ongeveer, afgelezen van een zijaanzicht van het origineel (modeleenheden):
#   {"as": "x"|"y", "voor": [lang, z], "achter": [lang, z], "r": straal}; hier verfijnd met een Hough-zoektocht in de buurt
import numpy as np
B_ = C['bron']; lang = 'xyz'.index(B_['as']); breed = 1 - lang
P = np.array([[v.co[0], v.co[1], v.co[2]] for v in me.vertices])
L_ = P[:, lang]; Z_ = P[:, 2]
hoeken = np.linspace(0, 2 * np.pi, 72, endpoint=False)
def verfijn(c, r0):
    best = None
    m = (np.abs(L_ - c[0]) < r0 * 1.4) & (np.abs(Z_ - c[1]) < r0 * 1.4)
    q = np.stack([L_[m], Z_[m]], 1)
    for r in np.linspace(r0 * 0.94, r0 * 1.06, 13):
        cl = (q[:, :1] + r * np.cos(hoeken)[None, :]).ravel(); cz = (q[:, 1:] + r * np.sin(hoeken)[None, :]).ravel()
        g = r0 * 0.015
        ok = (np.abs(cl - c[0]) < r0 * 0.1) & (np.abs(cz - c[1]) < r0 * 0.1)
        cel = np.stack([np.round((cl[ok] - c[0]) / g), np.round((cz[ok] - c[1]) / g)], 1).astype(np.int64)
        w, n = np.unique(cel, axis=0, return_counts=True)
        i = np.argmax(n)
        if best is None or n[i] > best[0]: best = (n[i], c[0] + w[i, 0] * g, c[1] + w[i, 1] * g, r)
    return best[1], best[2], best[3]
vl, vz, vr = verfijn(B_['voor'], B_['r']); al, az, ar = verfijn(B_['achter'], B_['r'])
r_ = (vr + ar) / 2
print('verfijnd voor', round(vl, 3), round(vz, 3), round(vr, 3), 'achter', round(al, 3), round(az, 3), round(ar, 3))
R = C['straal']; s = R / r_
# zijdelings midden: mediaan van de punten op de banden
op = (np.abs(np.hypot(L_ - vl, Z_ - vz) - vr) < r_ * 0.06) | (np.abs(np.hypot(L_ - al, Z_ - az) - ar) < r_ * 0.06)
bx = float(np.median(P[op, breed]))
richting = 1 if vl > al else -1
mid = (vl + al) / 2
hoek = math.atan2(vz - az, abs(vl - al))   # voorwiel hoger dan achterwiel: rechtzetten
for v in me.vertices:
    c = v.co; ll = (c[lang] - mid) * richting; zz = c.z - (vz + az) / 2
    # draai in het zijvlak zodat de assen even hoog komen
    l2 = ll * math.cos(-hoek) - zz * math.sin(-hoek); z2 = ll * math.sin(-hoek) + zz * math.cos(-hoek)
    v.co = Vector(((c[breed] - bx) * s, -l2 * s, z2 * s + R))
me.update()
half = math.hypot(vl - al, vz - az) / 2 * s
assen = [Vector((0, -half, R)), Vector((0, half, R))]
stralen = [vr * s, ar * s]   # elk wiel zijn eigen straal (de modellen zijn niet precies)
print('assen', [tuple(round(c, 3) for c in a_) for a_ in assen], 'schaal', round(s, 4), 'scheef', round(math.degrees(hoek), 2))
# wielen per vlakje: alle hoeken binnen de band (zijaanzicht) en binnen de bandbreedte; zo blijven vork en achterbrug aan het frame
BW = C.get('bandbreedte', 0.06)
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
wielvlak = {}
for f in bm.faces:
    for i, a_ in enumerate(assen):
        if all(math.hypot(v.co.y - a_.y, v.co.z - a_.z) < stralen[i] * 1.09 and abs(v.co.x - a_.x) < BW for v in f.verts):
            wielvlak[f.index] = i; break
# wielpunten splitsen van framepunten: wielvlakken los maken
randen = [e for e in bm.edges if len({wielvlak.get(f.index, -1) for f in e.link_faces}) > 1]
bmesh.ops.split_edges(bm, edges=randen)
bm.faces.ensure_lookup_table()
wielvan = {}
for f in bm.faces:
    if f.index in wielvlak:
        for v in f.verts: wielvan[v.index] = wielvlak[f.index]
bm.to_mesh(me); bm.free(); me.update()
print('wielpunten', sum(1 for i in wielvan.values() if i == 0), sum(1 for i in wielvan.values() if i == 1), 'van', len(me.vertices))

# kleuren per punt
def hexkl(h): return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1]
FRAME = [1, 0, 1, 1]
zadelZ = max(v.co.z for v in me.vertices if v.co.y > 0.05)          # hoogste punt achter het midden = zadel
kl = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
for v in me.vertices:
    p = v.co
    if v.index in wielvan:
        a_ = assen[wielvan[v.index]]; d = math.hypot(p.y - a_.y, p.z - a_.z)
        k = hexkl(C['band']) if d > stralen[wielvan[v.index]] - C.get('band_dikte', 0.04) else hexkl(C['metaal'])
    elif any(abs(p.x - a_.x) < BW and p.z < a_.z and stralen[i] * 0.8 < math.hypot(p.y - a_.y, p.z - a_.z) < stralen[i] * 1.2 for i, a_ in enumerate(assen)):
        k = hexkl(C['band'])   # stukjes band die aan het frame vastzitten (onderste helft: daar zit geen spatbord)
    elif p.y > 0.05 and p.z > zadelZ - 0.09 and abs(p.x) < 0.14: k = hexkl(C.get('zadel', '#1c1a18'))
    else: k = FRAME
    kl.data[v.index].color = k

# wielen in eigen objecten, met het draaipunt op de as
def splits(i, naam):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
    for v in me.vertices: v.select = wielvan.get(v.index) == i
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
    w = [o for o in bpy.context.selected_objects if o != ob][0]; w.name = naam
    bpy.context.view_layer.objects.active = w
    bpy.context.scene.cursor.location = assen[i]
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return w
wv = splits(0, 'wiel_voor'); wa = splits(1, 'wiel_achter'); ob.name = 'frame'

# minder driehoeken: het frame en de wielen elk naar hun deel van het doel
tel = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
totaal = tel(ob) + tel(wv) + tel(wa)
for o in (ob, wv, wa):
    r = min(1, C['doel'] / max(1, totaal))
    if r < 1:
        d = o.modifiers.new('m', 'DECIMATE'); d.ratio = r
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='m')
    for p in o.data.polygons: p.use_smooth = True
print('driehoeken', tel(ob), tel(wv), tel(wa))

# handvatten: de buitenste punten links en rechts, bovenin aan de voorkant
fv = [o.matrix_world @ v.co for v in ob.data.vertices for o in [ob]]
boven = [p for p in fv if p.y < 0 and p.z > max(q.z for q in fv) - 0.12]
hl = max(boven, key=lambda p: p.x); hr = min(boven, key=lambda p: p.x)
grip = lambda e: [round(c, 3) for c in Vector((e.x * 0.92, e.y, e.z))]
zadel = [p for p in fv if p.y > 0.05 and p.z > zadelZ - 0.03]
zy = sum(p.y for p in zadel) / len(zadel)
meta = {
  'wielen': [[round(c, 3) for c in a_] for a_ in assen], 'straal': R,
  'handvatten': [grip(hl), grip(hr)], 'zadel': [0, round(zy, 3), round(zadelZ, 3)],
  'maat': [round(max(p.x for p in fv) - min(p.x for p in fv), 3), round(max(p.y for p in fv) - min(p.y for p in fv), 3), round(max(p.z for p in fv), 3)],
}
json.dump(meta, open(META, 'w')); print('META', meta)
mat = bpy.data.materials.new('fiets'); mat.use_nodes = True
for o in (ob, wv, wa): o.data.materials.append(mat)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
