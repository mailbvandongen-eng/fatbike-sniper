# blender -b --python-use-system-env -P tools/speel/speel.py -- <in.glb> <uit.glb> <lengte m>
# Maakt van een gedownload speeltoestel (Sketchfab, CC BY) een spelmodel: op de grond, midden op 0, langste kant = lengte,
# alleen de kleurtextuur (geen normal- en glanskaarten: scheelt geheugen op de telefoon).
import bpy, sys
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
IN, OUT, LENGTE = a[0], a[1], float(a[2])
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=IN)
ms = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o not in ms: bpy.data.objects.remove(o)
P = [o.matrix_world @ v.co for o in ms for v in o.data.vertices]
mn = Vector([min(p[i] for p in P) for i in range(3)]); mx = Vector([max(p[i] for p in P) for i in range(3)])
s = LENGTE / max(mx.x - mn.x, mx.y - mn.y)
for o in ms:
    for v in o.data.vertices: v.co = Vector(((v.co.x - (mn.x + mx.x) / 2) * s, (v.co.y - (mn.y + mx.y) / 2) * s, (v.co.z - mn.z) * s))
    for m in o.data.materials:
        nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        for naam in ('Normal', 'Metallic', 'Roughness'):
            for l in list(bsdf.inputs[naam].links): nt.links.remove(l)
        bsdf.inputs['Metallic'].default_value = 0.1; bsdf.inputs['Roughness'].default_value = 0.6
print('MAAT', [round((mx[i] - mn[i]) * s, 2) for i in range(3)], 'vlakken', sum(len(o.data.polygons) for o in ms))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True)
