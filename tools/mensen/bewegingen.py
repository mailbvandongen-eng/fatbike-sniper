# blender -b --python-use-system-env -P tools/mensen/bewegingen.py -- <uit.glb>
# Alle bewegingen voor de mensen in één bestand, op het skelet van de Universal Animation Library (Quaternius, CC0).
# Uit deel 1 nemen we ze zoals ze zijn; een paar uit deel 2 (ander skelet, andere botnamen) zetten we om:
# per beeld krijgt elk bot dezelfde draaiing ten opzichte van zijn rusthouding als in het origineel.
import bpy, sys, re
from mathutils import Matrix, Quaternion

OUT = sys.argv[sys.argv.index('--') + 1]
UAL1 = '/tmp/fbs/ual1/UAL1.glb'
UAL2 = '/root/tools/homo-assets/dl-ual2/UAL2_Standard.glb'
DEEL1 = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sitting_Idle_Loop',
         'Sitting_Talking_Loop', 'Driving_Loop', 'Push_Loop', 'Death01', 'Hit_Chest', 'Crouch_Idle_Loop', 'Pistol_Aim_Neutral',
         'Pistol_Idle_Loop', 'Jump_Loop', 'Fixing_Kneeling', 'Punch_Jab', 'Punch_Cross', 'Punch_Enter', 'Hit_Head']
DEEL2 = ['Idle_TalkingPhone_Loop', 'LayToIdle', 'Hit_Knockback', 'Idle_No_Loop', 'Walk_Carry_Loop', 'Idle_FoldArms_Loop']

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
def importeer(pad):
    voor = set(bpy.data.objects); acties = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=pad, bone_heuristic='BLENDER')
    nieuw = set(bpy.data.objects) - voor
    arm = [o for o in nieuw if o.type == 'ARMATURE'][0]
    for o in nieuw:
        if o.type == 'MESH': bpy.data.objects.remove(o)
    return arm, [a for a in bpy.data.actions if a not in acties]
T, acties1 = importeer(UAL1)
for a in acties1:
    naam = a.name.split('|')[-1] if '|' in a.name else a.name
    naam = re.sub(r'_Armature$|_Rig$', '', naam)
    if naam in DEEL1: a.name = naam; a.use_fake_user = True
    else: bpy.data.actions.remove(a)
Sarm, acties2 = importeer(UAL2)

def ual(n):
    m = {'root': 'root', 'pelvis': 'DEF-hips', 'spine_01': 'DEF-spine.001', 'spine_02': 'DEF-spine.002', 'spine_03': 'DEF-spine.003',
         'neck_01': 'DEF-neck', 'Head': 'DEF-head', 'head': 'DEF-head'}
    if n in m: return m[n]
    if not re.search(r'_[lr]$', n): return None
    s = n[-1].upper(); base = n[:-2]
    t = {'clavicle': 'shoulder', 'upperarm': 'upper_arm', 'lowerarm': 'forearm', 'hand': 'hand', 'thigh': 'thigh', 'calf': 'shin', 'foot': 'foot', 'ball': 'toe'}
    if base in t: return f'DEF-{t[base]}.{s}'
    fm = re.match(r'(thumb|index|middle|ring|pinky)_0(\d)$', base)
    if fm and int(fm.group(2)) <= 3: return f'DEF-{"thumb" if fm.group(1) == "thumb" else "f_" + fm.group(1)}.0{fm.group(2)}.{s}'
    return None
tnames = {b.name for b in T.data.bones}
paar = [(s.name, ual(s.name)) for s in Sarm.data.bones if ual(s.name) in tnames]
print('omzetten met', len(paar), 'botten')
volgorde = []
def loop(b):
    volgorde.append(b.name)
    for c in b.children: loop(c)
for b in T.data.bones:
    if not b.parent: loop(b)
s2t = dict(paar); t2s = {t: s for s, t in paar}
SW, TW = Sarm.matrix_world, T.matrix_world
srest = {s: (SW @ Sarm.data.bones[s].matrix_local).to_quaternion() for s, _ in paar}
trest = {t: (TW @ T.data.bones[t].matrix_local).to_quaternion() for _, t in paar}
heup_s = (SW @ Sarm.data.bones['pelvis'].matrix_local).translation; heup_t = (TW @ T.data.bones['DEF-hips'].matrix_local).translation
maat = heup_t.z / max(1e-6, heup_s.z)

for a in acties2:
    naam = a.name.split('|')[-1]
    naam = re.sub(r'_Armature$', '', naam)
    if naam not in DEEL2: continue
    Sarm.animation_data_create(); Sarm.animation_data.action = a
    doel = bpy.data.actions.new(naam); doel.use_fake_user = True
    T.animation_data_create(); T.animation_data.action = doel
    for pb in T.pose.bones: pb.rotation_mode = 'QUATERNION'
    f0, f1 = int(a.frame_range[0]), int(a.frame_range[1])
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        for t in volgorde:
            pb = T.pose.bones[t]
            if t not in t2s: continue
            s = t2s[t]
            qs = (SW @ Sarm.pose.bones[s].matrix).to_quaternion()
            qt = qs @ srest[s].inverted() @ trest[t]
            m = qt.to_matrix().to_4x4()
            if t == 'DEF-hips':
                ps = (SW @ Sarm.pose.bones[s].matrix).translation
                m.translation = heup_t + (ps - heup_s) * maat
            else:
                m.translation = (TW @ pb.matrix).translation
            pb.matrix = TW.inverted() @ m
            bpy.context.view_layer.update()
            pb.keyframe_insert('rotation_quaternion', frame=f - f0)
            if t == 'DEF-hips': pb.keyframe_insert('location', frame=f - f0)
    T.animation_data.action = None
    print('omgezet', naam, f1 - f0 + 1, 'beelden')
bpy.data.objects.remove(Sarm)
for a in list(bpy.data.actions):
    if not a.use_fake_user: bpy.data.actions.remove(a)
# een stukje mesh is nodig, anders schrijft de exporter het skelet niet weg: een piepklein driehoekje aan de heup
me = bpy.data.meshes.new('anker'); me.from_pydata([(0, 0, 0), (0.001, 0, 0), (0, 0.001, 0)], [], [(0, 1, 2)])
ank = bpy.data.objects.new('anker', me); bpy.context.scene.collection.objects.link(ank)
ank.parent = T; ank.vertex_groups.new(name='DEF-hips').add([0, 1, 2], 1, 'REPLACE'); ank.modifiers.new('A', 'ARMATURE').object = T
T.name = 'Bewegingen'
print('acties', sorted(a.name for a in bpy.data.actions))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_animations=True, export_animation_mode='ACTIONS',
                          export_skins=True, export_def_bones=False, export_force_sampling=True, export_optimize_animation_size=True)
print('KLAAR', OUT)
