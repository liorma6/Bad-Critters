"""Copy generated originals; compress unchanged RGBA; measure sprite alpha bounds."""
from PIL import Image
from pathlib import Path
from collections import deque
import json, shutil
root=Path(__file__).resolve().parents[1]
sources=json.loads((root/'docs/dark-sources.json').read_text(encoding='utf-8'))
frames={}
for name,source in sources.items():
 im=Image.open(source)
 assert im.mode=='RGBA' and im.getchannel('A').histogram()[0]>10000, name
 im.save(root/'assets/art'/f'{name}.webp','WEBP',quality=88,method=6,exact=True)
 shutil.copy2(source,root/'docs/visual-reference'/f'{name}-source.png')
 if not name.endswith('-dark'): continue
 w,h=im.size
 mask=bytearray(a>100 for a in im.getchannel('A').getdata()); components=[]
 for start in range(len(mask)):
  if not mask[start]: continue
  mask[start]=0; q=deque([start]); pixels=[]
  while q:
   p=q.popleft(); pixels.append(p)
   for n in (p-w,p+w,p-1 if p%w else -1,p+1 if p%w<w-1 else -1):
    if 0<=n<len(mask) and mask[n]: mask[n]=0; q.append(n)
  if len(pixels)>5000:
   xs=[p%w for p in pixels];ys=[p//w for p in pixels]
   l,t,r,b=min(xs),min(ys),max(xs)+1,max(ys)+1
   core=sorted(p%w for p in pixels if t+(b-t)*.58<p//w<t+(b-t)*.72)
   components.append((l,t,r,b,core[len(core)//2]))
 components.sort(key=lambda p:(round(p[1]/(h/2)),p[0]))
 assert len(components)==6,(name,components)
 poses=[]
 for l,t,r,b,anchor in components:
  l=max(0,l-3);t=max(0,t-3);r=min(w,r+3);b=min(h,b+3)
  poses.append([l,t,r-l,b-t,anchor-l])
 frames[name.removesuffix('-dark')]=poses
 print(name,poses)
(root/'src/dark-frames.js').write_text('export const DARK_FRAMES='+json.dumps(frames)+';\n',encoding='utf-8')
