# Storm lighthouse: procedural build, one clay screenshot per build step.
# Run: blender -b -P build_scene.py
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Matrix, noise

OUT = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(OUT, "screenshots")
os.makedirs(SHOTS, exist_ok=True)
BLEND = os.path.join(OUT, "storm_lighthouse.blend")
FONT_DIR = r"C:\Windows\Fonts"
SHOT_FRAME = 263          # lightning strike frame: every system is visible here
TOTAL_STEPS = 10

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, 300
sc.render.fps = 24
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.resolution_percentage = 100
random.seed(7)

world = bpy.data.worlds.new("StormWorld")
sc.world = world
world.color = (0.075, 0.078, 0.085)       # clay background colour (workbench)

CLAY = (0.72, 0.72, 0.72, 1.0)


def coll(name):
    c = bpy.data.collections.new(name)
    sc.collection.children.link(c)
    return c

C_SCENE, C_FX, C_CAM, C_BADGE, C_TITLE = (coll(n) for n in ("Scene", "FX", "Cameras", "Badge", "Title"))


def link(ob, c=None, color=CLAY):
    for uc in list(ob.users_collection):
        uc.objects.unlink(ob)
    (c or C_SCENE).objects.link(ob)
    ob.color = color
    return ob


def keys(target, path, pairs, interp='LINEAR', index=-1):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = interp
    for f, v in pairs:
        if index >= 0:
            getattr(target, path)[index] = v
        else:
            setattr(target, path, v)
        target.keyframe_insert(path, frame=f, index=index)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------- material helpers ----------
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def N(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def L(nt, a, b):
    nt.links.new(a, b)


def principled(name, rgb, rough=0.8, emit=None, estr=0.0):
    m, nt, out = new_mat(name)
    b = N(nt, "ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = estr
    L(nt, b.outputs[0], out.inputs[0])
    return m


def glow_mat(name, rgb, strength, alpha=1.0):
    """Emission mixed with transparency; returns (mat, mix node, emission node)."""
    m, nt, out = new_mat(name)
    e = N(nt, "ShaderNodeEmission", Color=(*rgb, 1), Strength=strength)
    t = N(nt, "ShaderNodeBsdfTransparent")
    mx = N(nt, "ShaderNodeMixShader", Fac=alpha)
    L(nt, t.outputs[0], mx.inputs[1]); L(nt, e.outputs[0], mx.inputs[2]); L(nt, mx.outputs[0], out.inputs[0])
    m.surface_render_method = 'BLENDED'
    return m, mx, e


# ---------- overlays: badge + step label (clay screenshots only) ----------
seg_bold = bpy.data.fonts.load(os.path.join(FONT_DIR, "segoeuib.ttf"))
seg_reg = bpy.data.fonts.load(os.path.join(FONT_DIR, "segoeui.ttf"))
georgia = bpy.data.fonts.load(os.path.join(FONT_DIR, "georgia.ttf"))
georgia_i = bpy.data.fonts.load(os.path.join(FONT_DIR, "georgiai.ttf"))


def text_obj(name, body, size, font, c, color, align='CENTER', spacing=1.0):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body, cu.size, cu.font = body, size, font
    cu.align_x, cu.align_y = align, 'CENTER'
    cu.space_character = spacing
    return link(bpy.data.objects.new(name, cu), c, color)


def rrect_mesh(name, w, h, r, seg=8):
    pts = []
    for cx, cy, a0 in ((w/2-r, h/2-r, 0), (-w/2+r, h/2-r, 90), (-w/2+r, -h/2+r, 180), (w/2-r, -h/2+r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a), 0))
    me = bpy.data.meshes.new(name)
    me.from_pydata(pts, [], [list(range(len(pts)))])
    return me


badge_pill = link(bpy.data.objects.new("BadgePill", rrect_mesh("BadgePill", 0.20, 0.056, 0.028)), C_BADGE, (0.12, 0.16, 0.23, 1))
badge_text = text_obj("BadgeText", "Opus 5.5", 0.034, seg_bold, C_BADGE, (0.98, 0.57, 0.24, 1))
step_pill = link(bpy.data.objects.new("StepPill", rrect_mesh("StepPill", 0.68, 0.042, 0.021)), C_BADGE, (0.12, 0.16, 0.23, 1))
step_text = text_obj("StepText", "", 0.02, seg_reg, C_BADGE, (0.95, 0.95, 0.95, 1), align='LEFT')


def place_overlays(cam):
    hw = (cam.data.sensor_width / 2) / cam.data.lens
    hh = hw * 9 / 16
    s = hw / 0.514
    for ob, loc in ((badge_pill, (0, hh * 0.84, -1.0)), (badge_text, (0, hh * 0.84 - 0.002 * s, -0.999)),
                    (step_pill, (-hw * 0.94 + 0.325 * s, -hh * 0.88, -1.0)),
                    (step_text, (-hw * 0.94 + 0.018 * s, -hh * 0.88 - 0.002 * s, -0.999))):
        ob.parent = cam
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.location = loc
        ob.rotation_euler = (0, 0, 0)
        ob.scale = (s, s, s)


# ---------- cameras ----------
def camera(name, lens):
    cd = bpy.data.cameras.new(name)
    cd.lens, cd.clip_start, cd.clip_end = lens, 0.1, 3000
    return link(bpy.data.objects.new(name, cd), C_CAM)


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


build_cam = camera("BuildCam", 35)
build_cam.location = (-30, -88, 42)
aim(build_cam, (3, 6, 20))



def shot(n, label, cam=None):
    cam = cam or build_cam
    sc.camera = cam
    place_overlays(cam)
    step_text.data.body = f"STEP {n:02d} / {TOTAL_STEPS:02d}   {label}"
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light, sh.studio_light = 'STUDIO', 'Default'
    sh.color_type = 'OBJECT'
    sh.show_cavity, sh.cavity_type = True, 'BOTH'
    sh.show_shadows, sh.shadow_intensity = True, 0.45
    sh.show_specular_highlight = False
    sc.display.render_aa = '8'
    sc.view_settings.view_transform = 'Standard'
    sc.render.use_compositing = False
    C_BADGE.hide_render = False
    sc.frame_set(SHOT_FRAME)
    sc.render.filepath = os.path.join(SHOTS, f"step_{n:02d}.png")
    bpy.ops.render.render(write_still=True)
    print("SHOT", n, label, sc.render.filepath)


# =========================================================
# STEP 1  SEA
# =========================================================
bpy.ops.mesh.primitive_plane_add(size=2, location=(-40, -120, 0))
ocean_obj = link(bpy.context.object)
ocean_obj.name = "Ocean"
oc = ocean_obj.modifiers.new("Ocean", "OCEAN")
oc.geometry_mode = 'GENERATE'
oc.spatial_size, oc.repeat_x, oc.repeat_y = 100, 5, 5
oc.resolution, oc.viewport_resolution = 11, 8
oc.wind_velocity, oc.choppiness, oc.wave_alignment = 22, 1.3, 0.3
oc.wave_direction = math.radians(80)
oc.use_normals = True
oc.use_foam, oc.foam_layer_name, oc.foam_coverage = True, "foam", 0.35
oc.random_seed = 3
keys(oc, "time", [(1, 0.0), (300, 15.0)])
keys(oc, "wave_scale", [(1, 0.8), (190, 1.9)])
ocean_obj.data.polygons.foreach_set("use_smooth", [True])

sea_mat, nt, out = new_mat("Sea")
b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.07)
foam = nt.nodes.new("ShaderNodeAttribute"); foam.attribute_name = "foam"
fr = N(nt, "ShaderNodeMapRange"); fr.inputs["From Min"].default_value = 0.25; fr.inputs["From Max"].default_value = 0.9
L(nt, foam.outputs["Fac"], fr.inputs["Value"])
cm = N(nt, "ShaderNodeMix"); cm.data_type = 'RGBA'
cm.inputs["A"].default_value = (0.008, 0.022, 0.028, 1); cm.inputs["B"].default_value = (0.62, 0.68, 0.7, 1)
L(nt, fr.outputs[0], cm.inputs["Factor"]); L(nt, cm.outputs["Result"], b.inputs["Base Color"])
rr = N(nt, "ShaderNodeMapRange"); rr.name = "RoughMap"; rr.inputs["To Min"].default_value = 0.06; rr.inputs["To Max"].default_value = 0.55
L(nt, fr.outputs[0], rr.inputs["Value"]); L(nt, rr.outputs[0], b.inputs["Roughness"])
L(nt, b.outputs[0], out.inputs[0])
ocean_obj.data.materials.append(sea_mat)

bpy.ops.mesh.primitive_plane_add(size=3000, location=(0, 0, -0.35))
far_sea = link(bpy.context.object); far_sea.name = "FarSea"
far_mat = sea_mat.copy(); far_mat.name = "FarSea"
far_mat.node_tree.nodes["RoughMap"].inputs["To Min"].default_value = 0.5
far_sea.data.materials.append(far_mat)
shot(1, "SEA  -  procedural ocean modifier")

# =========================================================
# STEP 2  CLIFF
# =========================================================
def edge_y(x):
    return (0.0035 * x * x + 4.0 * noise.noise(Vector((x * 0.035, 1.7, 0.3)))
            + 1.5 * noise.noise(Vector((x * 0.12, 5.1, 0.9))))

LH = Vector((6.0, edge_y(6.0) + 9.0, 28.0))      # lighthouse site
HS = Vector((-10.0, edge_y(-10.0) + 17.0, 28.0))  # keeper's house site
PADS = [(LH.x, LH.y, 5.0), (HS.x, HS.y, 7.0)]


def height(x, y):
    d = y - edge_y(x)
    top = 27.0 + 2.5 * noise.noise(Vector((x * 0.02, y * 0.02, 0.5))) + 0.6 * noise.noise(Vector((x * 0.1, y * 0.1, 2.0)))
    for px, py, r in PADS:
        w = 1.0 - smoothstep(r, r + 5.0, math.hypot(x - px, y - py))
        top = top + (28.0 - top) * w
    t = smoothstep(-7.0, 1.5, d) * smoothstep(86.0, 76.0, abs(x)) * smoothstep(122.0, 110.0, y)
    h = -5.0 + (top + 5.0) * t
    face = 4 * t * (1 - t)
    h += 2.4 * noise.noise(Vector((x * 0.22, y * 0.22, h * 0.12))) * face
    return h, face


step = 0.7
xs = [-95 + i * step for i in range(int(190 / step) + 1)]
ys = [-25 + j * step for j in range(int(152 / step) + 1)]
verts, faces, weights = [], [], []
for y in ys:
    for x in xs:
        h, f = height(x, y)
        verts.append((x, y, h)); weights.append(f)
nx = len(xs)
for j in range(len(ys) - 1):
    for i in range(nx - 1):
        a = j * nx + i
        faces.append((a, a + 1, a + 1 + nx, a + nx))
me = bpy.data.meshes.new("Cliff")
me.from_pydata(verts, [], faces)
me.polygons.foreach_set("use_smooth", [True] * len(faces))
cliff = link(bpy.data.objects.new("Cliff", me))
vg = cliff.vertex_groups.new(name="face")
for i, w in enumerate(weights):
    if w > 0.02:
        vg.add([i], min(1.0, w * 1.6), 'REPLACE')
tex = bpy.data.textures.new("RockVoronoi", 'VORONOI'); tex.noise_scale = 2.2
dm = cliff.modifiers.new("Rocky", 'DISPLACE'); dm.texture = tex; dm.strength = 1.4; dm.vertex_group = "face"
dm.texture_coords = 'GLOBAL'

cliff_mat, nt, out = new_mat("CliffRock")
b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.9)
geo = nt.nodes.new("ShaderNodeNewGeometry")
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Normal"], sep.inputs[0])
g = N(nt, "ShaderNodeMapRange"); g.inputs["From Min"].default_value = 0.72; g.inputs["From Max"].default_value = 0.88
L(nt, sep.outputs["Z"], g.inputs["Value"])
sepp = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Position"], sepp.inputs[0])
hz = N(nt, "ShaderNodeMapRange"); hz.inputs["From Min"].default_value = 22.0; hz.inputs["From Max"].default_value = 25.0
L(nt, sepp.outputs["Z"], hz.inputs["Value"])
gm = N(nt, "ShaderNodeMath"); gm.operation = 'MULTIPLY'; L(nt, g.outputs[0], gm.inputs[0]); L(nt, hz.outputs[0], gm.inputs[1])
nz = N(nt, "ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.6; nz.inputs["Detail"].default_value = 8
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.045, 0.04, 0.036, 1); ramp.color_ramp.elements[1].color = (0.2, 0.18, 0.16, 1)
L(nt, nz.outputs["Fac"], ramp.inputs[0])
wet = N(nt, "ShaderNodeMapRange"); wet.inputs["From Min"].default_value = 0.5; wet.inputs["From Max"].default_value = 3.0
wet.inputs["To Min"].default_value = 0.35; wet.inputs["To Max"].default_value = 1.0
L(nt, sepp.outputs["Z"], wet.inputs["Value"])
rock = N(nt, "ShaderNodeMix"); rock.data_type = 'RGBA'; rock.blend_type = 'MULTIPLY'
rock.inputs["Factor"].default_value = 1.0
L(nt, ramp.outputs[0], rock.inputs["A"]); L(nt, wet.outputs[0], rock.inputs["B"])
grass = N(nt, "ShaderNodeMix"); grass.data_type = 'RGBA'
grass.inputs["B"].default_value = (0.07, 0.1, 0.04, 1)
L(nt, gm.outputs[0], grass.inputs["Factor"]); L(nt, rock.outputs["Result"], grass.inputs["A"])
L(nt, grass.outputs["Result"], b.inputs["Base Color"])
bn = N(nt, "ShaderNodeBump", Strength=0.6); nz2 = N(nt, "ShaderNodeTexNoise"); nz2.inputs["Scale"].default_value = 3.0
L(nt, nz2.outputs["Fac"], bn.inputs["Height"]); L(nt, bn.outputs[0], b.inputs["Normal"])
L(nt, b.outputs[0], out.inputs[0])
cliff.data.materials.append(cliff_mat)
shot(2, "CLIFF  -  noise heightfield + voronoi displace")

# =========================================================
# STEP 3  ROCKS
# =========================================================
rock_mat = principled("WetRock", (0.035, 0.035, 0.037), rough=0.35)
rock_tex = bpy.data.textures.new("RockClouds", 'CLOUDS'); rock_tex.noise_scale = 0.7
rocks = []
for i in range(24):
    x = random.uniform(-48, 50)
    y = edge_y(x) - random.uniform(6, 17)
    r = random.uniform(1.6, 4.5)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1, location=(x, y, random.uniform(-1.2, 0.2)))
    ob = link(bpy.context.object); ob.name = f"Rock_{i:02d}"
    ob.scale = (r * random.uniform(0.8, 1.4), r * random.uniform(0.8, 1.3), r * random.uniform(0.6, 1.1))
    ob.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)
    d = ob.modifiers.new("Crag", 'DISPLACE'); d.texture = rock_tex; d.strength = 0.55; d.texture_coords = 'GLOBAL'
    ob.data.polygons.foreach_set("use_smooth", [True] * len(ob.data.polygons))
    ob.data.materials.append(rock_mat)
    rocks.append(ob)
shot(3, "ROCKS  -  displaced icospheres at the cliff foot")

# =========================================================
# STEP 4  LIGHTHOUSE TOWER
# =========================================================
def cyl(name, r, depth, z, verts=48, r2=None, mat=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(LH.x, LH.y, z))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=(LH.x, LH.y, z))
    ob = link(bpy.context.object); ob.name = name
    if mat:
        ob.data.materials.append(mat)
    return ob

stone = principled("Stone", (0.3, 0.29, 0.27), 0.85)
dark_metal = principled("DarkMetal", (0.03, 0.03, 0.032), 0.4)
red_paint = principled("RedPaint", (0.42, 0.035, 0.03), 0.5)

stripe, nt, out = new_mat("TowerStripes")
b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.55)
tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["Object"], sp.inputs[0])
m1 = N(nt, "ShaderNodeMath"); m1.operation = 'MULTIPLY_ADD'; m1.inputs[1].default_value = 0.2; m1.inputs[2].default_value = 2.0
L(nt, sp.outputs["Z"], m1.inputs[0])
fr_ = N(nt, "ShaderNodeMath"); fr_.operation = 'FRACT'; L(nt, m1.outputs[0], fr_.inputs[0])
gt = N(nt, "ShaderNodeMath"); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; L(nt, fr_.outputs[0], gt.inputs[0])
mx = N(nt, "ShaderNodeMix"); mx.data_type = 'RGBA'
mx.inputs["A"].default_value = (0.82, 0.8, 0.74, 1); mx.inputs["B"].default_value = (0.45, 0.035, 0.03, 1)
L(nt, gt.outputs[0], mx.inputs["Factor"]); L(nt, mx.outputs["Result"], b.inputs["Base Color"]); L(nt, b.outputs[0], out.inputs[0])

z0 = LH.z
cyl("LH_Plinth", 3.5, 1.8, z0 + 0.4, mat=stone)
tower = cyl("LH_Tower", 2.7, 20.0, z0 + 1.3 + 10.0, r2=1.8, mat=stripe)
tower.data.polygons.foreach_set("use_smooth", [True] * len(tower.data.polygons))
deck_z = z0 + 21.3
cyl("LH_Gallery", 2.7, 0.35, deck_z + 0.17, mat=dark_metal)
bpy.ops.mesh.primitive_torus_add(major_radius=2.55, minor_radius=0.05, location=(LH.x, LH.y, deck_z + 1.2))
link(bpy.context.object).data.materials.append(dark_metal)
for i in range(16):
    a = i / 16 * math.tau
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.04, depth=1.0,
                                        location=(LH.x + 2.55 * math.cos(a), LH.y + 2.55 * math.sin(a), deck_z + 0.7))
    link(bpy.context.object).data.materials.append(dark_metal)
# door facing the house, three slit windows
to_house = (HS - LH).normalized()
ang = math.atan2(to_house.y, to_house.x)
bpy.ops.mesh.primitive_cube_add(size=1, location=(LH.x + 2.62 * math.cos(ang), LH.y + 2.62 * math.sin(ang), z0 + 2.6))
door = link(bpy.context.object); door.scale = (0.3, 1.1, 2.2); door.rotation_euler.z = ang
door.data.materials.append(dark_metal)
for k, zz in enumerate((z0 + 7, z0 + 12, z0 + 17)):
    rad = 2.7 - (zz - z0 - 1.3) / 20 * 0.9 + 0.03
    a = ang + math.pi + 0.6 * k
    bpy.ops.mesh.primitive_cube_add(size=1, location=(LH.x + rad * math.cos(a), LH.y + rad * math.sin(a), zz))
    w = link(bpy.context.object); w.scale = (0.2, 0.5, 1.0); w.rotation_euler.z = a
    w.data.materials.append(dark_metal)
shot(4, "LIGHTHOUSE  -  tapered tower, gallery, railing")

# =========================================================
# STEP 5  LANTERN ROOM + TURNING BEAM
# =========================================================
lamp_z = deck_z + 1.55
glass, _, _ = glow_mat("LanternGlass", (1.0, 0.75, 0.45), 1.2, alpha=0.18)
cyl("LH_Lantern", 1.35, 2.4, deck_z + 1.55, verts=16, mat=glass).visible_shadow = False
for i in range(8):
    a = i / 8 * math.tau
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.05, depth=2.4,
                                        location=(LH.x + 1.36 * math.cos(a), LH.y + 1.36 * math.sin(a), lamp_z))
    link(bpy.context.object).data.materials.append(dark_metal)
cyl("LH_Roof", 1.65, 1.3, deck_z + 3.4, verts=16, r2=0.25, mat=red_paint)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(LH.x, LH.y, deck_z + 4.15))
link(bpy.context.object).data.materials.append(dark_metal)
cyl("LH_Spire", 0.06, 1.2, deck_z + 4.8, verts=8, mat=dark_metal)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(LH.x, LH.y, lamp_z))
lamp = link(bpy.context.object); lamp.name = "LH_Lamp"
lamp.data.materials.append(principled("LampCore", (1, 0.9, 0.7), 0.3, emit=(1.0, 0.82, 0.55), estr=80))

ld = bpy.data.lights.new("LampLight", 'POINT'); ld.energy = 1500; ld.color = (1.0, 0.8, 0.55); ld.shadow_soft_size = 0.4
link(bpy.data.objects.new("LampLight", ld), C_FX).location = (LH.x, LH.y, lamp_z)

pivot = link(bpy.data.objects.new("BeamPivot", None), C_FX)
pivot.location = (LH.x, LH.y, lamp_z)
keys(pivot, "rotation_euler", [(1, 0.0), (300, 2.5 * math.tau)], index=2)

beam_mat, nt, out = new_mat("Beam")
tcb = nt.nodes.new("ShaderNodeTexCoord"); spb = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tcb.outputs["Generated"], spb.inputs[0])
along = N(nt, "ShaderNodeMath"); along.operation = 'SUBTRACT'; along.inputs[0].default_value = 1.0; L(nt, spb.outputs["X"], along.inputs[1])
alp = N(nt, "ShaderNodeMath"); alp.operation = 'POWER'; alp.inputs[1].default_value = 1.6; L(nt, along.outputs[0], alp.inputs[0])
lw = N(nt, "ShaderNodeLayerWeight", Blend=0.5)
edge = N(nt, "ShaderNodeMath"); edge.operation = 'SUBTRACT'; edge.inputs[0].default_value = 1.0; L(nt, lw.outputs["Facing"], edge.inputs[1])
edge2 = N(nt, "ShaderNodeMath"); edge2.operation = 'POWER'; edge2.inputs[1].default_value = 2.0; L(nt, edge.outputs[0], edge2.inputs[0])
mask = N(nt, "ShaderNodeMath"); mask.operation = 'MULTIPLY'; L(nt, alp.outputs[0], mask.inputs[0]); L(nt, edge2.outputs[0], mask.inputs[1])
beam_strength = nt.nodes.new("ShaderNodeValue"); beam_strength.name = "BeamStrength"
bs = N(nt, "ShaderNodeMath"); bs.operation = 'MULTIPLY'; L(nt, mask.outputs[0], bs.inputs[0]); L(nt, beam_strength.outputs[0], bs.inputs[1])
em = N(nt, "ShaderNodeEmission", Color=(1.0, 0.86, 0.62, 1)); L(nt, bs.outputs[0], em.inputs["Strength"])
tr = N(nt, "ShaderNodeBsdfTransparent")
add = N(nt, "ShaderNodeAddShader"); L(nt, tr.outputs[0], add.inputs[0]); L(nt, em.outputs[0], add.inputs[1])
L(nt, add.outputs[0], out.inputs[0])
beam_mat.surface_render_method = 'BLENDED'
beam_mat.use_backface_culling = False
keys(beam_strength.outputs[0], "default_value", [(1, 0.5), (120, 1.4), (200, 2.4)])


def beam_mesh(name, length=120.0, r0=0.35, r1=4.5):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=40, radius1=r0, radius2=r1, depth=length)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, length / 2))
    bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.radians(92.5), 3, 'Y'))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me

for k in range(2):
    bo = link(bpy.data.objects.new(f"Beam_{k}", beam_mesh(f"Beam_{k}")), C_FX)
    bo.data.materials.append(beam_mat)
    bo.parent = pivot; bo.rotation_euler.z = k * math.pi
    bo.visible_shadow = False
    sd = bpy.data.lights.new(f"BeamSpot_{k}", 'SPOT')
    sd.spot_size, sd.spot_blend, sd.color, sd.shadow_soft_size = math.radians(10), 0.4, (1.0, 0.85, 0.6), 0.2
    so = link(bpy.data.objects.new(f"BeamSpot_{k}", sd), C_FX)
    so.parent = pivot
    # spot shines down its -Z: turn it to +X, 2.5 degrees below the horizon, like the beam
    so.matrix_basis = Matrix.Rotation(k * math.pi, 4, 'Z') @ Matrix.Rotation(math.radians(-87.5), 4, 'Y')
    keys(sd, "energy", [(1, 60000), (120, 250000), (200, 500000)])
shot(5, "LANTERN ROOM + TWIN TURNING BEAMS")

# =========================================================
# STEP 6  KEEPER'S HOUSE
# =========================================================
house_rot = ang + math.pi / 2
R = Matrix.Rotation(house_rot, 4, 'Z')
W, D, Hh = 7.0, 4.6, 3.2


def hpart(name, loc, scale, mat, prim='cube'):
    p = Vector(HS) + (R @ Vector(loc))
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    ob = link(bpy.context.object); ob.name = name
    ob.scale = scale; ob.rotation_euler.z = house_rot
    ob.data.materials.append(mat)
    return ob

walls = principled("Whitewash", (0.74, 0.71, 0.65), 0.9)
slate = principled("Slate", (0.07, 0.075, 0.085), 0.65)
wood = principled("Wood", (0.12, 0.06, 0.03), 0.7)
window_mat = principled("WarmWindow", (1.0, 0.6, 0.3), 0.4, emit=(1.0, 0.58, 0.24), estr=9)
hpart("House_Walls", (0, 0, Hh / 2 - 0.2), (W, D, Hh + 0.4), walls)
a, bb, rh = W / 2 + 0.35, D / 2 + 0.45, 2.1
rv = [(-a, -bb, 0), (a, -bb, 0), (a, bb, 0), (-a, bb, 0), (-a, 0, rh), (a, 0, rh)]
rme = bpy.data.meshes.new("House_Roof")
rme.from_pydata(rv, [], [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (0, 3, 2, 1)])
roof = link(bpy.data.objects.new("House_Roof", rme))
roof.location = Vector(HS) + Vector((0, 0, Hh)); roof.rotation_euler.z = house_rot
sol = roof.modifiers.new("Thick", 'SOLIDIFY'); sol.thickness = 0.18
roof.data.materials.append(slate)
hpart("House_Chimney", (W / 2 - 1.2, 0.9, Hh + 1.9), (0.8, 0.8, 2.4), stone)
hpart("House_Door", (0.0, -D / 2 - 0.03, 1.0), (1.0, 0.12, 2.0), wood)
for i, x in enumerate((-2.3, 2.3)):
    hpart(f"House_WinF{i}", (x, -D / 2 - 0.03, 1.7), (1.0, 0.1, 1.0), window_mat)
    hpart(f"House_WinFbarV{i}", (x, -D / 2 - 0.09, 1.7), (0.08, 0.06, 1.04), wood)
    hpart(f"House_WinFbarH{i}", (x, -D / 2 - 0.09, 1.7), (1.04, 0.06, 0.08), wood)
    hpart(f"House_WinB{i}", (x, D / 2 + 0.03, 1.7), (1.0, 0.1, 1.0), window_mat)
hpart("House_WinSide", (-W / 2 - 0.03, 0, 1.7), (0.1, 1.0, 1.0), window_mat)
for i, x in enumerate((-2.3, 2.3)):
    wl = bpy.data.lights.new(f"WindowGlow_{i}", 'POINT'); wl.energy = 250; wl.color = (1.0, 0.6, 0.3); wl.shadow_soft_size = 0.5
    link(bpy.data.objects.new(f"WindowGlow_{i}", wl), C_FX).location = Vector(HS) + (R @ Vector((x, -D / 2 - 1.2, 1.7)))
shot(6, "KEEPER'S HOUSE  -  lit windows, slate roof, chimney")

# =========================================================
# STEP 7  WAVES HITTING THE ROCKS (splash bursts)
# =========================================================
foam_mat = principled("SplashFoam", (0.85, 0.9, 0.92), 0.6, emit=(0.6, 0.66, 0.72), estr=0.35)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.16, location=(0, 0, -50))
droplet = link(bpy.context.object, C_FX); droplet.name = "SplashDroplet"
droplet.data.materials.append(foam_mat)
droplet.hide_render = True; droplet.hide_viewport = True

seaward = sorted(rocks, key=lambda r: r.location.y)[:7]
for e, rk in enumerate(seaward):
    bpy.ops.mesh.primitive_circle_add(vertices=16, radius=max(rk.scale) * 0.9, fill_type='NGON',
                                      location=(rk.location.x, rk.location.y - max(rk.scale) * 0.5, 0.4))
    em_ob = link(bpy.context.object, C_FX); em_ob.name = f"SplashEmitter_{e}"
    em_ob.show_instancer_for_render = False; em_ob.show_instancer_for_viewport = False
    start = 20 + e * 13
    k = 0
    while start < 296:
        mod = em_ob.modifiers.new(f"burst{k}", 'PARTICLE_SYSTEM')
        ps = em_ob.particle_systems[-1]
        s = ps.settings
        s.count, s.frame_start, s.frame_end = 160, start, start + 4
        s.lifetime, s.lifetime_random = 40, 0.4
        s.emit_from = 'FACE'
        s.normal_factor, s.factor_random = 7.5 + random.random() * 3, 2.8
        s.render_type, s.instance_object = 'OBJECT', droplet
        s.particle_size, s.size_random = 1.0, 0.7
        s.use_rotations = False
        ps.seed = e * 31 + k
        ps.point_cache.frame_start, ps.point_cache.frame_end = 1, 300
        ps.point_cache.use_disk_cache = True
        start += random.randint(38, 55)
        k += 1
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.ptcache.bake_all(bake=True)
print("BAKED splashes")
shot(7, "WAVES ON THE ROCKS  -  timed splash bursts")

# =========================================================
# STEP 8  RAIN
# =========================================================
rain_mat, rain_mix, _ = glow_mat("Rain", (0.62, 0.68, 0.78), 0.9, alpha=0.25)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.015, radius2=0.015, depth=0.9)
# tilt the streak like the emitters so it lies along the fall direction
bmesh.ops.rotate(bm, verts=bm.verts, matrix=(Matrix.Rotation(math.radians(20), 3, 'Z') @ Matrix.Rotation(math.radians(9), 3, 'X')))
rme = bpy.data.meshes.new("RainStreak"); bm.to_mesh(rme); bm.free()
streak = link(bpy.data.objects.new("RainStreak", rme), C_FX)
streak.location = (0, 0, -60); streak.data.materials.append(rain_mat)
streak.hide_render = True; streak.hide_viewport = True
streak.visible_shadow = False

for k, (count, f0, loc, size) in enumerate(((40000, 80, (5, -10, 55), 150), (45000, 150, (14, -64, 32), 40))):
    bpy.ops.mesh.primitive_plane_add(size=size, location=loc)
    re = link(bpy.context.object, C_FX); re.name = f"RainEmitter_{k}"
    re.rotation_euler = (math.radians(180 + 9), 0, math.radians(20))
    re.show_instancer_for_render = False; re.show_instancer_for_viewport = False
    re.modifiers.new("rain", 'PARTICLE_SYSTEM')
    ps = re.particle_systems[-1]; s = ps.settings
    s.count, s.frame_start, s.frame_end = count, f0, 300
    s.lifetime = 60 if k == 0 else 35
    s.emit_from = 'FACE'
    s.normal_factor, s.factor_random = 30, 1.5
    s.render_type, s.instance_object = 'OBJECT', streak
    s.particle_size, s.size_random = 1.0, 0.4
    s.use_rotations = False
    ps.seed = 101 + k
    ps.point_cache.frame_start, ps.point_cache.frame_end = 1, 300
    ps.point_cache.use_disk_cache = True
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.ptcache.bake_all(bake=True)
print("BAKED rain")
shot(8, "RAIN  -  two particle emitters, slanted streaks")

# =========================================================
# STEP 9  STORM: SKY, CLOUDS, LIGHTNING
# =========================================================
def bolt_points(p0, p1, iters=7, rough=0.42, rng=None):
    pts = [Vector(p0), Vector(p1)]
    disp = (Vector(p1) - Vector(p0)).length * rough
    for _ in range(iters):
        new = [pts[0]]
        for a_, b_ in zip(pts[:-1], pts[1:]):
            mid = (a_ + b_) / 2 + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 0.3))) * disp
            new += [mid, b_]
        pts = new
        disp *= 0.55
    return pts


def make_bolt(name, top, bottom, seed):
    rng = random.Random(seed)
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution = 0.22, 1
    main = bolt_points(top, bottom, rng=rng)

    def add_spline(pts, r0, r1):
        spl = cu.splines.new('POLY'); spl.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            spl.points[i].co = (*p, 1)
            spl.points[i].radius = r0 + (r1 - r0) * i / (len(pts) - 1)
    add_spline(main, 1.0, 0.7)
    for _ in range(5):
        i0 = rng.randint(len(main) // 8, len(main) * 3 // 4)
        start = main[i0]
        end = start + Vector((rng.uniform(-18, 18), rng.uniform(-10, 10), -rng.uniform(10, 26)))
        add_spline(bolt_points(start, end, iters=5, rough=0.5, rng=rng), 0.5, 0.08)
    ob = link(bpy.data.objects.new(name, cu), C_FX)
    ob.data.materials.append(bolt_mat)
    ob.visible_shadow = False
    return ob

bolt_mat = principled("Lightning", (1, 1, 1), 0.5, emit=(0.72, 0.8, 1.0), estr=90)
hero_bolt = make_bolt("Bolt_Hero", (58, 30, 110), (46, -18, -0.5), 11)
far_bolt = make_bolt("Bolt_Far", (-120, 60, 120), (-95, 20, 0), 23)


def visible_on(ob, frames, span=(1, 300)):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'CONSTANT'
    for f in range(span[0], span[1] + 1):
        want = f in frames
        prev = (f - 1) in frames
        if f == span[0] or want != prev:
            ob.hide_render = not want
            ob.hide_viewport = not want
            ob.keyframe_insert("hide_render", frame=f)
            ob.keyframe_insert("hide_viewport", frame=f)

visible_on(hero_bolt, {262, 263, 265, 266, 267})
visible_on(far_bolt, {188, 190})
FLASH = [(1, 0), (127, 0), (128, 0.5), (129, 0.15), (130, 0.8), (131, 0), (187, 0), (188, 1.0), (189, 0.3),
         (190, 1.1), (191, 0), (261, 0), (262, 1.6), (263, 0.7), (264, 0.25), (265, 1.9), (266, 1.0), (267, 0.5), (268, 0.15), (269, 0)]

fd = bpy.data.lights.new("LightningFlash", 'SUN'); fd.color = (0.72, 0.8, 1.0); fd.angle = math.radians(8)
fo = link(bpy.data.objects.new("LightningFlash", fd), C_FX)
fo.rotation_euler = (Vector((-40, -60, -90))).to_track_quat('-Z', 'Y').to_euler()
keys(fd, "energy", [(f, v * 2.0) for f, v in FLASH], interp='CONSTANT')

sun_dir = Vector((-0.78, 0.6, 0.12)).normalized()
sd_ = bpy.data.lights.new("DuskSun", 'SUN'); sd_.color = (1.0, 0.52, 0.28); sd_.angle = math.radians(2)
so_ = link(bpy.data.objects.new("DuskSun", sd_), C_FX)
so_.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
keys(sd_, "energy", [(1, 4.5), (90, 2.0), (150, 0.0)])
md = bpy.data.lights.new("MoonFill", 'SUN'); md.color = (0.55, 0.65, 0.9); md.energy = 0.6
mo = link(bpy.data.objects.new("MoonFill", md), C_FX)
mo.rotation_euler = (Vector((-0.3, 0.5, -0.8))).to_track_quat('-Z', 'Y').to_euler()

# world: dusk gradient -> storm night, projected cloud layer, lightning flash
wnt = world.node_tree if world.node_tree else None
try:
    world.use_nodes = True
except Exception:
    pass
wnt = world.node_tree
for n in list(wnt.nodes):
    wnt.nodes.remove(n)
wout = wnt.nodes.new("ShaderNodeOutputWorld")
bg = N(wnt, "ShaderNodeBackground", Strength=1.0)
L(wnt, bg.outputs[0], wout.inputs[0])
storm = wnt.nodes.new("ShaderNodeValue"); storm.name = "Storm"
flash = wnt.nodes.new("ShaderNodeValue"); flash.name = "Flash"
keys(storm.outputs[0], "default_value", [(1, 0.0), (70, 0.15), (190, 1.0)])
keys(flash.outputs[0], "default_value", FLASH, interp='CONSTANT')
wtc = wnt.nodes.new("ShaderNodeTexCoord")
wsep = wnt.nodes.new("ShaderNodeSeparateXYZ"); L(wnt, wtc.outputs["Generated"], wsep.inputs[0])


def ramp_node(stops):
    r = wnt.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]:
        e = els.new(p); e.color = (*c, 1)
    L(wnt, wsep.outputs["Z"], r.inputs[0])
    return r

dusk = ramp_node([(0.0, (0.9, 0.36, 0.14)), (0.06, (0.85, 0.34, 0.2)), (0.2, (0.38, 0.2, 0.32)), (0.5, (0.08, 0.08, 0.2)), (1.0, (0.02, 0.03, 0.09))])
night = ramp_node([(0.0, (0.035, 0.042, 0.058)), (0.25, (0.01, 0.013, 0.022)), (1.0, (0.004, 0.005, 0.01))])
sky = N(wnt, "ShaderNodeMix"); sky.data_type = 'RGBA'
L(wnt, storm.outputs[0], sky.inputs["Factor"]); L(wnt, dusk.outputs[0], sky.inputs["A"]); L(wnt, night.outputs[0], sky.inputs["B"])
# sun glow
dot = N(wnt, "ShaderNodeVectorMath"); dot.operation = 'DOT_PRODUCT'; dot.inputs[1].default_value = sun_dir
L(wnt, wtc.outputs["Generated"], dot.inputs[0])
dpos = N(wnt, "ShaderNodeMath"); dpos.operation = 'MAXIMUM'; dpos.inputs[1].default_value = 0.0; L(wnt, dot.outputs["Value"], dpos.inputs[0])
dpow = N(wnt, "ShaderNodeMath"); dpow.operation = 'POWER'; dpow.inputs[1].default_value = 10.0; L(wnt, dpos.outputs[0], dpow.inputs[0])
inv = N(wnt, "ShaderNodeMath"); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; L(wnt, storm.outputs[0], inv.inputs[1])
gl = N(wnt, "ShaderNodeMath"); gl.operation = 'MULTIPLY'; L(wnt, dpow.outputs[0], gl.inputs[0]); L(wnt, inv.outputs[0], gl.inputs[1])
glow = N(wnt, "ShaderNodeMix"); glow.data_type = 'RGBA'; glow.blend_type = 'ADD'
glow.inputs["B"].default_value = (2.2, 0.9, 0.35, 1)
L(wnt, gl.outputs[0], glow.inputs["Factor"]); L(wnt, sky.outputs["Result"], glow.inputs["A"])
# cloud layer: project direction onto a plane above the viewer
zoff = N(wnt, "ShaderNodeMath"); zoff.operation = 'ADD'; zoff.inputs[1].default_value = 0.09; L(wnt, wsep.outputs["Z"], zoff.inputs[0])
zc = wnt.nodes.new("ShaderNodeCombineXYZ"); L(wnt, zoff.outputs[0], zc.inputs[0]); L(wnt, zoff.outputs[0], zc.inputs[1]); zc.inputs[2].default_value = 1.0
xy = wnt.nodes.new("ShaderNodeCombineXYZ"); L(wnt, wsep.outputs["X"], xy.inputs[0]); L(wnt, wsep.outputs["Y"], xy.inputs[1])
proj = N(wnt, "ShaderNodeVectorMath"); proj.operation = 'DIVIDE'; L(wnt, xy.outputs[0], proj.inputs[0]); L(wnt, zc.outputs[0], proj.inputs[1])
mp = wnt.nodes.new("ShaderNodeMapping"); L(wnt, proj.outputs[0], mp.inputs["Vector"])
keys(mp.inputs["Location"], "default_value", [(1, (0.0, 0.0, 0.0)), (300, (1.6, 0.9, 0.5))])
cn = N(wnt, "ShaderNodeTexNoise"); cn.inputs["Scale"].default_value = 1.1; cn.inputs["Detail"].default_value = 9
cn.inputs["Roughness"].default_value = 0.62
L(wnt, mp.outputs["Vector"], cn.inputs["Vector"])
cov = N(wnt, "ShaderNodeMath"); cov.operation = 'MULTIPLY_ADD'; cov.inputs[1].default_value = -0.2; cov.inputs[2].default_value = 0.58
L(wnt, storm.outputs[0], cov.inputs[0])
cov2 = N(wnt, "ShaderNodeMath"); cov2.operation = 'ADD'; cov2.inputs[1].default_value = 0.2; L(wnt, cov.outputs[0], cov2.inputs[0])
cmr = N(wnt, "ShaderNodeMapRange"); L(wnt, cn.outputs["Fac"], cmr.inputs["Value"])
L(wnt, cov.outputs[0], cmr.inputs["From Min"]); L(wnt, cov2.outputs[0], cmr.inputs["From Max"])
hfade = N(wnt, "ShaderNodeMapRange"); hfade.inputs["From Min"].default_value = -0.02; hfade.inputs["From Max"].default_value = 0.12
L(wnt, wsep.outputs["Z"], hfade.inputs["Value"])
cmask = N(wnt, "ShaderNodeMath"); cmask.operation = 'MULTIPLY'; L(wnt, cmr.outputs[0], cmask.inputs[0]); L(wnt, hfade.outputs[0], cmask.inputs[1])
ccol = N(wnt, "ShaderNodeMix"); ccol.data_type = 'RGBA'
ccol.inputs["A"].default_value = (0.5, 0.27, 0.24, 1); ccol.inputs["B"].default_value = (0.014, 0.016, 0.022, 1)
L(wnt, storm.outputs[0], ccol.inputs["Factor"])
cflash = N(wnt, "ShaderNodeMix"); cflash.data_type = 'RGBA'; cflash.blend_type = 'ADD'
cflash.inputs["B"].default_value = (0.3, 0.33, 0.45, 1)
L(wnt, flash.outputs[0], cflash.inputs["Factor"]); L(wnt, ccol.outputs["Result"], cflash.inputs["A"])
withc = N(wnt, "ShaderNodeMix"); withc.data_type = 'RGBA'
L(wnt, cmask.outputs[0], withc.inputs["Factor"]); L(wnt, glow.outputs["Result"], withc.inputs["A"]); L(wnt, cflash.outputs["Result"], withc.inputs["B"])
fl = N(wnt, "ShaderNodeMix"); fl.data_type = 'RGBA'; fl.blend_type = 'ADD'
fl.inputs["B"].default_value = (0.06, 0.07, 0.1, 1)
L(wnt, flash.outputs[0], fl.inputs["Factor"]); L(wnt, withc.outputs["Result"], fl.inputs["A"])
L(wnt, fl.outputs["Result"], bg.inputs["Color"])
shot(9, "STORM  -  lightning bolts, flashes, sky + cloud shader")

# =========================================================
# STEP 10  HERO CAMERA + TITLE
# =========================================================
hero = camera("HeroCam", 30)
hero.data.clip_start = 0.5
target = link(bpy.data.objects.new("HeroTarget", None), C_CAM)
tt = hero.constraints.new('TRACK_TO'); tt.target = target; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'
keys(hero, "location", [(1, (-62, -165, 30)), (200, (30, -105, 10)), (300, (27, -96, 9.4))], interp='BEZIER')
keys(target, "location", [(1, (0, 0, 24)), (200, (9, 0, 31)), (300, (9, 0, 32))], interp='BEZIER')

title_mat, title_mix, _ = glow_mat("TitleGold", (1.0, 0.86, 0.62), 2.2, alpha=0.0)
keys(title_mix.inputs["Fac"], "default_value", [(1, 0.0), (212, 0.0), (240, 1.0)])
rig = link(bpy.data.objects.new("TitleRig", None), C_TITLE)
rig.parent = hero; rig.matrix_parent_inverse = Matrix.Identity(4)
rig.location = (0, 0, -3.0)
keys(rig, "scale", [(212, (0.965, 0.965, 0.965)), (300, (1.0, 1.0, 1.0))])
GOLD = (0.95, 0.72, 0.36, 1)
t1 = text_obj("Title", "THE KEEPER'S LIGHT", 0.2, georgia, C_TITLE, GOLD, spacing=1.18)
t2 = text_obj("Subtitle", "a procedural storm", 0.075, georgia_i, C_TITLE, GOLD, spacing=1.25)
lines = []
for i, y in enumerate((-0.2, -0.66)):
    bpy.ops.mesh.primitive_plane_add(size=1)
    ln = link(bpy.context.object, C_TITLE, GOLD); ln.name = f"TitleRule_{i}"
    lines.append((ln, y))
for ob, y in ((t1, -0.38), (t2, -0.54)) + tuple(lines):
    ob.parent = rig; ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.location = (0, y, 0)
    ob.data.materials.append(title_mat)
    ob.visible_shadow = False
for ln, _ in lines:
    ln.scale = (1.5, 0.0045, 1)
shot(10, "HERO CAMERA + SERIF TITLE", cam=hero)

# =========================================================
# final render settings (EEVEE) + save
# =========================================================
sc.render.engine = 'BLENDER_EEVEE'
ee = sc.eevee
ee.taa_render_samples = 24
ee.use_shadows = True
ee.shadow_resolution_scale = 0.5
ee.use_raytracing = False
sc.render.use_motion_blur = False
sc.view_settings.view_transform = 'AgX'
try:
    sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception as ex:
    print("LOOK skipped", ex)
sc.camera = hero
C_BADGE.hide_render = True
try:
    tree = bpy.data.node_groups.new("StormComp", "CompositorNodeTree")
    tree.interface.new_socket(name="Image", in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = tree.nodes.new("CompositorNodeRLayers")
    gln = tree.nodes.new("CompositorNodeGlare")
    gln.inputs["Type"].default_value = 'Bloom'
    gln.inputs["Threshold"].default_value = 1.2
    gln.inputs["Strength"].default_value = 0.55
    gln.inputs["Size"].default_value = 0.6
    go = tree.nodes.new("NodeGroupOutput")
    tree.links.new(rl.outputs["Image"], gln.inputs["Image"])
    tree.links.new(gln.outputs["Image"], go.inputs[0])
    sc.compositing_node_group = tree
    sc.render.use_compositing = True
    print("COMPOSITOR bloom OK")
except Exception as ex:
    print("COMPOSITOR skipped", ex)
sc.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("BUILD_OK", BLEND)
