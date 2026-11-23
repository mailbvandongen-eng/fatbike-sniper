# blender -b --python-use-system-env -P tools/autos/auto.py -- <in.glb> <uit.glb> <uit.json> '<json>' [controle.png]
# Maakt van een gedownload automodel (Sketchfab, CC BY) een spelmodel:
#  - echte lengte, voorkant naar -Y (wordt +z in three), wielen op de grond, midden op 0
#  - wielen als losse onderdelen (draaipunt op de as), gevonden aan hun vorm: ronde, smalle losse delen op de grond
#  - de materialen blijven (lak en glas herkent het spel aan hun naam, zie autos.json)
#  - een lichte versie voor ver weg (alles in één, sterk vereenvoudigd)
# json: {"lengte": m, "voor": 1|-1, "ratio": 0..1, "lak": [...], "glas": [...]}
import bpy, bmesh, sys, json, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]
IN, OUT, META, C = a[0], a[1], a[2], json.loads(a[3])
PNG = a[4] if len(a) > 4 else None
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
# materialen zonder plaatje (behalve lak en glas) worden één materiaal "kleur" met de kleur per punt: veel minder tekenopdrachten
kl = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
kleurmat = bpy.data.materials.new('kleur'); kleurmat.use_nodes = True
bsdf = kleurmat.node_tree.nodes['Principled BSDF']; vc = kleurmat.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
kleurmat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.6
me.materials.append(kleurmat); ki = len(me.materials) - 1
def info(m):
    if not m or not m.use_nodes: return None, False
    b = m.node_tree.nodes.get('Principled BSDF')
    tex = any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes)
    if m.name in C.get('kleuren', {}): return list(C['kleuren'][m.name]) + [1], False   # eigen kleur voor dit onderdeel (bijv. zwarte velgen)
    return (list(b.inputs['Base Color'].default_value) if b else [0.8, 0.8, 0.8, 1]), tex
vast = set(C.get('lak', [])) | set(C.get('glas', []))
for p_ in me.polygons:
    m = me.materials[p_.material_index]
    kleur, tex = info(m)
    samen = m and m.name not in vast and not tex and kleur
    c = kleur if samen else [1, 1, 1, 1]
    for li in p_.loop_indices: kl.data[li].color = c
    if samen: p_.material_index = ki
V = [v.co.copy() for v in me.vertices]
ext = [max(v[i] for v in V) - min(v[i] for v in V) for i in range(3)]
lang = 0 if ext[0] > ext[1] else 1; breed = 1 - lang
s = C['lengte'] / ext[lang]
mid = [(max(v[i] for v in V) + min(v[i] for v in V)) / 2 for i in range(3)]; zmin = min(v.z for v in V)
for v in me.vertices:
    c = v.co
    x = (c[breed] - mid[breed]) * s; y = -C.get('voor', 1) * (c[lang] - mid[lang]) * s
    # spiegeling voorkomen: draai (x, y) in plaats van omklappen
    if (lang == 0) != (C.get('voor', 1) > 0): x = -x
    v.co = Vector((x, y, (c.z - zmin) * s))
me.update()
# getinte ruiten achter: glas achter de voorstoelen krijgt een eigen, donker materiaal
if 'glasAchter' in C:
    donker = bpy.data.materials.new('glas_donker'); me.materials.append(donker); di = len(me.materials) - 1
    for p_ in me.polygons:
        m = me.materials[p_.material_index]
        if m and m.name in C.get('glas', []) and sum(me.vertices[i].co.y for i in p_.vertices) / len(p_.vertices) > C['glasAchter']: p_.material_index = di
# normalen kunnen omgeklapt zijn door de as-wissel
bm = bmesh.new(); bm.from_mesh(me)
# test: spiegelt de afbeelding? determinant van de as-afbeelding
det = 1
ax = [[0, 0, 0], [0, 0, 0], [0, 0, 1]]
sx = -1 if (lang == 0) != (C.get('voor', 1) > 0) else 1
ax[0][breed] = sx; ax[1][lang] = -C.get('voor', 1)
det = Matrix(ax).determinant()
if det < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces)
# ---- wielen: losse delen die rond, smal en laag zijn ----
tag = bm.verts.layers.int.new('wiel')   # eerst de laag: een nieuwe laag maakt eerdere verwijzingen ongeldig
bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
B = max(abs(v.co.x) for v in bm.verts)
gezien = set(); delen = []
for v in bm.verts:
    if v.index in gezien: continue
    deel = []; st = [v]; gezien.add(v.index)
    while st:
        w = st.pop(); deel.append(w)
        for e in w.link_edges:
            u = e.other_vert(w)
            if u.index not in gezien: gezien.add(u.index); st.append(u)
    mn = Vector([min(w.co[i] for w in deel) for i in range(3)]); mx = Vector([max(w.co[i] for w in deel) for i in range(3)])
    delen.append((deel, mn, mx))
wielen = []
for deel, mn, mx in delen:
    d = mx - mn
    if 0.45 < d.z < 0.9 and 0.8 < d.y / d.z < 1.25 and d.x < 0.42 and mn.z < 0.12 and abs((mn.x + mx.x) / 2) > B * 0.45:
        wielen.append({'c': (mn + mx) / 2, 'r': d.z / 2, 'v': list(deel)})
# samenvoegen per hoek (band en velg zijn soms aparte delen) en kleine delen in het wiel erbij
hoeken = {}
for w in wielen:
    k = (w['c'].x > 0, w['c'].y > 0)
    if k not in hoeken or w['r'] > hoeken[k]['r']: 
        if k in hoeken: w['v'] += hoeken[k]['v']
        hoeken[k] = w
    else: hoeken[k]['v'] += w['v']
inwiel = {id(v) for w in hoeken.values() for v in w['v']}
for deel, mn, mx in delen:
    if id(deel[0]) in inwiel: continue
    c = (mn + mx) / 2
    for w in hoeken.values():
        if math.hypot(c.y - w['c'].y, c.z - w['c'].z) < w['r'] * 0.5 and abs(c.x - w['c'].x) < 0.2 and (mx - mn).z < w['r'] * 2.05 and (mx - mn).y < w['r'] * 2.05 and (mx - mn).x < 0.45:
            w['v'] += deel; break
print('WIELEN', len(hoeken), [(k, round(w['r'], 3), [round(c, 2) for c in w['c']]) for k, w in hoeken.items()])
# wielen op de grond: gemiddelde straal = ashoogte
namen = {(True, False): 1, (False, False): 2, (True, True): 3, (False, True): 4}   # voor = -y
for k, w in hoeken.items():
    for v in w['v']: v[tag] = namen[k]
bm.to_mesh(me); bm.free(); me.update()
# per wiel afsplitsen
tagdata = me.attributes['wiel'].data
wobj = {}
for k, w in hoeken.items():
    n = namen[k]
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
    td = ob.data.attributes['wiel'].data
    for v in ob.data.vertices: v.select = td[v.index].value == n
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
    nw = [o for o in bpy.context.selected_objects if o != ob][0]
    nw.name = 'wiel_' + {1: 'vl', 2: 'vr', 3: 'al', 4: 'ar'}[n]
    bpy.context.view_layer.objects.active = nw
    bpy.context.scene.cursor.location = w['c']; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    wobj[n] = nw
ob.name = 'romp'
tel = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
def minder(o, ratio):
    if ratio >= 1: return
    d = o.modifiers.new('m', 'DECIMATE'); d.ratio = ratio
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='m')
print('driehoeken voor', tel(ob), [tel(w) for w in wobj.values()])
minder(ob, C.get('ratio', 1))
for w in wobj.values(): minder(w, min(1, 260 / max(1, tel(w))))
# lichte versie: alles in één, sterk vereenvoudigd
bpy.ops.object.select_all(action='DESELECT')
kop = []
for o in [ob] + list(wobj.values()):
    c = o.copy(); c.data = o.data.copy(); bpy.context.scene.collection.objects.link(c); kop.append(c); c.select_set(True)
bpy.context.view_layer.objects.active = kop[0]; bpy.ops.object.join(); ver = bpy.context.view_layer.objects.active; ver.name = 'ver'
bpy.ops.object.origin_set(type='ORIGIN_CURSOR') if False else None
minder(ver, min(1, C.get('ver', 900) / max(1, tel(ver))))
print('driehoeken na', tel(ob), [tel(w) for w in wobj.values()], 'ver', tel(ver))
for o in [ob, ver] + list(wobj.values()):
    for a_ in list(o.data.attributes):
        if a_.name == 'wiel': o.data.attributes.remove(a_)
# plaatjes klein
for im in bpy.data.images:
    if im.size[0] > 256: im.scale(256, max(1, int(256 * im.size[1] / im.size[0])))
print('MATERIALEN', sorted({m.name for o in [ob] for m in o.data.materials if m}))
fv = [v.co for v in ob.data.vertices]
meta = {'wielen': {o.name: [round(c, 3) for c in o.location] for o in wobj.values()}, 'straal': round(sum(w['r'] for w in hoeken.values()) / max(1, len(hoeken)), 3),
        'maat': [round(max(p.x for p in fv) - min(p.x for p in fv), 3), round(max(p.y for p in fv) - min(p.y for p in fv), 3), round(max(p.z for p in fv), 3)],
        'lak': C.get('lak', []), 'glas': C.get('glas', []), 'glasDonker': ['glas_donker'] if 'glasAchter' in C else [], 'stoel': C.get('stoel')}
json.dump(meta, open(META, 'w')); print('META', meta)
if PNG:
    sc = bpy.context.scene; cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
    ver.hide_render = True
    cam.location = Vector((3.5, -6.5, 2.6)); dd = Vector((0, 0, 0.6)) - cam.location; cam.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.color_type = 'TEXTURE'; sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x = 700; sc.render.resolution_y = 450; sc.render.filepath = PNG
    bpy.ops.render.render(write_still=True)
    ver.hide_render = False
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_image_format='WEBP', export_image_quality=80, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
