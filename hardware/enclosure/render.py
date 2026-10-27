"""
Pictures of the enclosure from its STL meshes: a small flat-shaded z-buffer
renderer (plain Python + Pillow, no GPU or OpenGL needed).

  render.py out.png eye=x,y,z at=x,y,z [explode=mm] [noback] mesh.stl:colour ...

colour is #rrggbb. A mesh whose name starts with "back" moves by explode along +y
(the assembly stands upright: z up, the front faces -y).
"""
import math, sys
from PIL import Image

W, H = 1400, 1000
SS = 2                                  # supersampling, for smooth edges

def load(path):
	tris, cur = [], []
	for line in open(path):
		t = line.split()
		if t and t[0] == 'vertex':
			cur.append(tuple(float(v) for v in t[1:4]))
			if len(cur) == 3:
				tris.append(cur)
				cur = []
	return tris

def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def norm(a):
	l = math.sqrt(dot(a, a)) or 1
	return (a[0] / l, a[1] / l, a[2] / l)

def main():
	out, args = sys.argv[1], sys.argv[2:]
	opts = dict(a.split('=', 1) for a in args if '=' in a and ':' not in a)
	eye = tuple(map(float, opts['eye'].split(',')))
	at = tuple(map(float, opts['at'].split(',')))
	explode = float(opts.get('explode', 0))
	meshes = [a.rsplit(':', 1) for a in args if ':' in a and '=' not in a]
	if 'noback' in args:
		meshes = [m for m in meshes if not m[0].split('/')[-1].startswith('back')]

	f = norm(sub(at, eye))                       # camera frame
	r = norm(cross(f, (0, 0, 1)))
	u = cross(r, f)
	light = norm((0.4, -0.7, 0.9))
	fov = math.radians(32)
	w, h = W * SS, H * SS
	scale = (h / 2) / math.tan(fov / 2)
	zbuf = [math.inf] * (w * h)
	img = [(247, 247, 247)] * (w * h)

	for path, colour in meshes:
		base = tuple(int(colour.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
		dy = explode if path.split('/')[-1].startswith('back') else 0
		for tri in load(path):
			p = [(v[0], v[1] + dy, v[2]) for v in tri]
			n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])))
			if dot(n, f) > 0:
				n = (-n[0], -n[1], -n[2])        # light both sides alike
			shade = 0.38 + 0.62 * max(0.0, dot(n, light))
			c = tuple(min(255, int(ch * shade)) for ch in base)
			scr = []
			for v in p:                            # perspective projection
				d = sub(v, eye)
				z = dot(d, f)
				if z <= 1:
					break
				scr.append((w / 2 + scale * dot(d, r) / z, h / 2 - scale * dot(d, u) / z, z))
			if len(scr) < 3:
				continue
			(x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = scr
			area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
			if abs(area) < 1e-9:
				continue
			for y in range(max(0, int(min(y0, y1, y2))), min(h - 1, int(max(y0, y1, y2)) + 1) + 1):
				for x in range(max(0, int(min(x0, x1, x2))), min(w - 1, int(max(x0, x1, x2)) + 1) + 1):
					px, py = x + 0.5, y + 0.5
					a = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area
					b = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area
					g = 1 - a - b
					if a < 0 or b < 0 or g < 0:
						continue
					z = a * z0 + b * z1 + g * z2
					i = y * w + x
					if z < zbuf[i]:
						zbuf[i] = z
						img[i] = c
	im = Image.new('RGB', (w, h))
	im.putdata(img)
	im.resize((W, H), Image.LANCZOS).save(out)
	print('wrote', out)

main()
