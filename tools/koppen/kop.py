# blender -b --python-use-system-env -P tools/koppen/kop.py -- <in.glb> <uit.glb> <breedte m>
# Maakt van een gedownloade dierenkop (Sketchfab, CC BY) een kop voor een vechter: midden op 0, de opgegeven breedte,
# neus naar -Y in Blender (= +z in het spel), alleen de kleurtextuur.
import bpy, sys
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
IN, OUT, BREED = a[0], a[1], float(a[2])
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
P = [v.co for v in ob.data.vertices]
mn = Vector([min(p[i] for p in P) for i in range(3)]); mx = Vector([max(p[i] for p in P) for i in range(3)])
s = BREED / (mx.x - mn.x); c = (mn + mx) / 2
for v in ob.data.vertices: v.co = (v.co - c) * s
for m in ob.data.materials:
    if not m or not m.use_nodes: continue
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b: continue
    for naam in ('Normal', 'Metallic', 'Roughness'):
        for l in list(b.inputs[naam].links): m.node_tree.links.remove(l)
    b.inputs['Metallic'].default_value = 0; b.inputs['Roughness'].default_value = 0.9
for p in ob.data.polygons: p.use_smooth = True
print('MAAT', [round((mx[i] - mn[i]) * s, 2) for i in range(3)], 'vlakken', len(ob.data.polygons))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True)
