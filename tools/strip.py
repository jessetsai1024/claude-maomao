import json
from PIL import Image, ImageDraw
d = json.load(open('sim.json')); W, H = d['W'], d['H']; S = 8
names = list(d['frames']); LBL = 150
img = Image.new('RGB', (LBL + W*S, (H*S+4)*len(names)), (60,40,40))
dr = ImageDraw.Draw(img)
for i, n in enumerate(names):
    oy = i*(H*S+4)
    dr.rectangle([LBL, oy, LBL+W*S-1, oy+H*S-1], fill=(30,30,30))
    dr.text((4, oy+H*S//2-6), n, fill=(230,230,230))
    for j, c in enumerate(d['frames'][n]):
        if c < 0: continue
        x, y = j % W, j // W
        dr.rectangle([LBL+x*S, oy+y*S, LBL+x*S+S-1, oy+y*S+S-1], fill=((c>>16)&255,(c>>8)&255,c&255))
half = len(names)//2
img.crop((0,0,img.width,(H*S+4)*half)).save('strip-1.png'); img.crop((0,(H*S+4)*half,img.width,img.height)).save('strip-2.png')
print(len(names)); print('\n'.join(d['log']))
