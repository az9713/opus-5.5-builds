# Render the EEVEE animation from storm_lighthouse.blend.
# Full run:  blender -b storm_lighthouse.blend -P render_final.py
# Test run:  blender -b storm_lighthouse.blend -P render_final.py -- test 1 150 263
import bpy, os, sys

OUT = os.path.dirname(bpy.data.filepath)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.camera = bpy.data.objects["HeroCam"]
bpy.data.collections["Badge"].hide_render = True
sc.render.use_compositing = True
sc.render.image_settings.file_format = 'PNG'

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args and args[0] == "test":
    for f in map(int, args[1:]):
        sc.frame_set(f)
        sc.render.filepath = os.path.join(OUT, "test", f"eevee_{f:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("TEST_FRAME", f)
else:
    sc.render.filepath = os.path.join(OUT, "frames", "f_")
    sc.render.use_overwrite = False       # resume-safe: skip frames already on disk
    sc.render.use_placeholder = True
    bpy.ops.render.render(animation=True)
    print("RENDER_OK")
