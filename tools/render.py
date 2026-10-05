import json, sys
from PIL import Image, ImageDraw
d = json.load(open('frames.json')); W, H = d['W'], d['H']; S = 14
names = list(d['frames'])
for bgname, bg in (('dark', (30,30,30)), ('light', (250,250,250))):
    img = Image.new('RGB', (W*S*len(names) + 10*(len(names)-1), H*S), (90,60,60))
    for i, n in enumerate(names):
        ox = i*(W*S+10)
        ImageDraw.Draw(img).rectangle([ox, 0, ox+W*S-1, H*S-1], fill=bg)
        for j, c in enumerate(d['frames'][n]):
            if c < 0: continue
            x, y = j % W, j // W
            ImageDraw.Draw(img).rectangle([ox+x*S, y*S, ox+x*S+S-1, y*S+S-1], fill=((c>>16)&255,(c>>8)&255,c&255))
    img.save(f'preview-{bgname}.png')
print('ok', d['cellsLen'])
