"""Compress generated sheets unchanged and measure alpha for runtime framing."""
from PIL import Image
from pathlib import Path
import json, shutil
from collections import deque

root = Path(__file__).resolve().parents[1]
sources = json.loads((root / 'docs/character-sources.json').read_text(encoding='utf-8'))
frames = {}
for name, source in sources.items():
    im = Image.open(source)
    assert im.mode == 'RGBA' and im.size == (1536, 1024)
    destination = root / 'assets/art' / f'{name}-poses.webp'
    im.save(destination, 'WEBP', quality=88, method=6, exact=True)
    shutil.copy2(source, root / 'docs/visual-reference' / f'{name}-poses-source.png')
    alpha = im.getchannel('A')
    # Connected-component bounds avoid a neighboring pose that crosses a grid edge.
    mask = bytearray(1 if a > 100 else 0 for a in alpha.getdata())
    components=[]
    for start in range(len(mask)):
        if not mask[start]: continue
        mask[start]=0; queue=deque([start]); pixels=[]
        while queue:
            p=queue.popleft(); pixels.append(p)
            for q in (p-1536,p+1536,p-1 if p%1536 else -1,p+1 if p%1536<1535 else -1):
                if 0<=q<len(mask) and mask[q]: mask[q]=0; queue.append(q)
        if len(pixels)>10000:
            xs=[p%1536 for p in pixels]; ys=[p//1536 for p in pixels]
            l,t,r,b=min(xs),min(ys),max(xs)+1,max(ys)+1
            # Project the torso center onto the ground. Anchoring to the leading
            # foot would shift the whole body sideways on alternating frames.
            core=sorted(p%1536 for p in pixels if t+(b-t)*.58<p//1536<t+(b-t)*.72)
            components.append((l,t,r,b,core[len(core)//2]))
    assert len(components)==6, (name,components)
    components.sort(key=lambda p: (round(p[1]/512),p[0]))
    poses=[]
    for l,t,r,b,anchor in components:
        pad=3; l=max(0,l-pad); t=max(0,t-pad); r=min(1536,r+pad); b=min(1024,b+pad)
        poses.append([l,t,r-l,b-t,anchor-l])
    frames[name] = poses
    hist = alpha.histogram()
    print(name, destination.stat().st_size, 'bytes', round(hist[0]/(1536*1024)*100,1), '% fully transparent', poses)
(root / 'src/character-frames.js').write_text('// Alpha bounds measured from unmodified generated sheets. Row-major: idle, walk A, walk B, watched, carry, caught.\nexport const CHARACTER_FRAMES='+json.dumps(frames)+';\n', encoding='utf-8')
