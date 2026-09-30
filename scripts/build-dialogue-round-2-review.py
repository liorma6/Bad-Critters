"""Build only the round-two review. Earlier documents and portraits are read-only."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape
from collections import Counter
from PIL import Image
import json, base64, hashlib, re
from rtl_docx_blocks import NS, run, paragraph, table, profile, pagebreak

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/dialogue-review'
NAME='Neighborhood-Animals-Dialogue-Changes-Review-Round-2'
TEMPLATE=OUT/'Neighborhood-Animals-Dialogue-Changes-Review.docx'
DATA=json.loads((OUT/'round-2-review-source.json').read_text(encoding='utf-8'))
BASE=json.loads((ROOT/'.cache/dialogue-round2-baseline.json').read_text(encoding='utf-8'))
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
PR='http://schemas.openxmlformats.org/package/2006/relationships'

# Format the generated sprite for the document without modifying the illustration.
source=Image.open(ROOT/'assets/art/badger-alive.webp').convert('RGBA')
source.thumbnail((300,360),Image.Resampling.LANCZOS)
portrait=Image.new('RGBA',(320,380))
portrait.alpha_composite(source,((320-source.width)//2,380-source.height))
portrait.save(OUT/'portraits/badger-round-2.png')
for c in DATA['characters']:
 c['image_uri']='data:image/png;base64,'+base64.b64encode((OUT/c['portrait']).read_bytes()).decode()

INTRO=[
 'במסמך הזה מופיעים רק 28 המשפטים ששונו בסבב התיקונים השני. הנוסח הראשי הוא זה שהוטמע במשחק ובתסריטי ההקלטה.',
 'לכל דמות סעיף נפרד למשפטים משותפים, ואחריו המשפטים ששונו בכל תיק. משפט משותף מופיע פעם אחת בלבד. ליד כל משפט מופיעים המזהה, ההקשר והנחיית הקראה קצרה.',
 'זלמן בטוח שהוא מצליח בחיזור; הפרטים שהוא מספר חושפים את ההפך. עמוס מתחשבן על כל אגורה, עם פאוץ׳ מטבעות וקבלות.',
 'ירחמיאל מנהל עכשיו פנקס תלונות על ברכות בוקר. התצפית והפנקס אינם ראיה לפשע; עדותו על הכניסה והאליבי במאפייה נשמרו.',
 'מרגלית ורינה לא שונו ואינן מופיעות במסמך. המסמכים הקודמים נשמרו בנפרד. המסמך כולל מידע חקירתי.',
]
PAGES=[]
for c in DATA['characters']:
 if c['id']=='snake':
  PAGES.extend([{'character':c,'sections':[s for s in c['sections'] if s['index']==0],'first':True},
                {'character':c,'sections':[s for s in c['sections'] if s['index']!=0],'first':False}])
 else:PAGES.append({'character':c,'sections':c['sections'],'first':True})
def h(s):return escape(str(s),{'"':'&quot;'})
def scope(l):return ('בתיקים ' if len(l['cases'])>1 else 'בתיק ')+', '.join(map(str,l['cases']))
def counts(c):return [sum(len(s['lines']) for s in c['sections'] if s['index']==i) for i in range(4)]
previous_html=(OUT/'Neighborhood-Animals-Dialogue-Changes-Review.html').read_text(encoding='utf-8')
style=re.search(r'<style>(.*?)</style>',previous_html,re.S).group(1)
html='<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+h(DATA['title'])+'</title><style>'+style+'</style><body>'
html+='<section class="sheet cover"><div class="eyebrow">'+h(DATA['date'])+' · סבב תיקונים 2</div><h1>חיות שכונה<br>סבב תיקונים 2</h1><div class="subtitle">'+h(DATA['subtitle'])+'</div>'
html+=''.join('<p>'+h(p)+'</p>' for p in INTRO)
head=['דמות','משותפים','תיק 1','תיק 2','תיק 3','סך הכול']
html+='<table><thead><tr>'+''.join('<th>'+h(t)+'</th>' for t in head)+'</tr></thead><tbody>'
for c in DATA['characters']:html+='<tr><td>'+h(c['name'])+'</td>'+''.join('<td>'+str(n)+'</td>' for n in counts(c)+[c['count']])+'</tr>'
html+='</tbody></table><p class="callout">עמוס: חמישה משפטים בתיק השרפה וחמישה בתיק הרצח. שלושה משותפים — שבעה מזהים בסך הכול. בתיק הרצח כל משפטיו נאמרים לפני מותו.</p><small>כל 28 המשפטים קיבלו גרסה חדשה. הקלטות קודמות שלהם דורשות הקלטה מחדש; שאר ההקלטות נשמרות.</small><div class="footer"><span>חיות שכונה · סבב תיקונים 2</span><span>1</span></div></section>'
for number,page in enumerate(PAGES,2):
 c=page['character']
 html+='<section class="sheet"><header class="profile"><img src="'+c['image_uri']+'" alt="'+h(c['name'])+'"><div><div class="eyebrow">סבב תיקונים 2 · הנוסח שהוטמע</div><h1>'+h(c['name'])+'</h1><p>'+h(c['description'])+'</p></div></header>'
 for section in page['sections']:
  html+='<section class="group"><h2>'+h(section['title'])+'</h2>'
  for line in section['lines']:
   html+='<article class="line" data-line-id="'+line['id']+'"><div class="line-meta"><span class="code">'+line['id']+' · v'+str(line['version'])+'</span> · '+h(line['context'])+' · '+h(scope(line))+'</div><p class="line-text">'+h(line['text'])+'</p>'
   if line['hint']:html+='<p class="hint">ביצוע: '+h(line['hint'])+'</p>'
   html+='</article>'
  html+='</section>'
 html+='<div class="footer"><span>'+h(c['name'])+' · סבב תיקונים 2</span><span>'+str(number)+'</span></div></section>'
html+='</body></html>'
(OUT/(NAME+'.html')).write_text(html,encoding='utf-8')

body=paragraph(DATA['date']+' · סבב תיקונים 2',size=20,color='75614A',after=130)
body+=paragraph('חיות שכונה',size=58,bold=True,after=50)+paragraph('סבב תיקונים 2',size=46,bold=True,after=100)+paragraph(DATA['subtitle'],size=29,after=200)
for p in INTRO:body+=paragraph(p,size=25,after=140)
rows=[[paragraph(t,size=20,bold=True,after=60) for t in head]]
for c in DATA['characters']:rows.append([paragraph(c['name'],size=22,after=90)]+[paragraph(str(n),size=22,after=90) for n in counts(c)+[c['count']]])
body+=table(rows,[2560,1480,1480,1480,1480,1480])
body+=paragraph('עמוס: חמישה משפטים בתיק השרפה וחמישה בתיק הרצח. שלושה משותפים — שבעה מזהים בסך הכול. בתיק הרצח כל משפטיו נאמרים לפני מותו.',size=25,before=180,after=140)
body+=paragraph('כל 28 המשפטים קיבלו גרסה חדשה. הקלטות קודמות שלהם דורשות הקלטה מחדש; שאר ההקלטות נשמרות.',size=22)
for page in PAGES:
 c=page['character'];body+=pagebreak()+profile(c,page['first'])
 for section in page['sections']:
  body+=paragraph(section['title'],style='Heading2',size=31,bold=True,before=110,after=120,keep=True)
  for line in section['lines']:
   body+=paragraph(runs=run(line['id']+' · v'+str(line['version']),size=18,color='7B7F71',rtl=False)+run(' · '+line['context']+' · '+scope(line),size=18,color='68786B'),after=40,keep=True)
   body+=paragraph(line['text'],size=26,after=40 if line['hint'] else 135,keep=bool(line['hint']),line=350)
   if line['hint']:body+=paragraph('ביצוע: '+line['hint'],size=19,color='8B6B45',after=135)

images={'word/media/'+c['id']+'.png':(OUT/c['portrait']).read_bytes() for c in DATA['characters']}
with ZipFile(TEMPLATE) as old:
 original=ET.fromstring(old.read('word/document.xml'))
 sect=ET.tostring(original.find('.//{'+W+'}sectPr'),encoding='unicode')
 document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+sect+'</w:body></w:document>'
 core='<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+h(DATA['title'])+'</dc:title><dc:subject>רק המשפטים ששונו בסבב 2</dc:subject></cp:coreProperties>'
 rels=ET.fromstring(old.read('word/_rels/document.xml.rels'))
 for rel in list(rels):
  if rel.attrib.get('Type','').endswith('/image') and 'word/'+rel.attrib['Target'] not in images:rels.remove(rel)
 replacements={'word/document.xml':document.encode(),'docProps/core.xml':core.encode(),'word/_rels/document.xml.rels':ET.tostring(rels,encoding='utf-8',xml_declaration=True),**images}
 with ZipFile(OUT/(NAME+'.docx'),'w',ZIP_DEFLATED) as new:
  for name in old.namelist():
   if name.startswith('word/media/') and name not in images:continue
   new.writestr(name,replacements.get(name,old.read(name)))
  for c in DATA['characters']:
   if c['id']!='badger':assert images['word/media/'+c['id']+'.png']==old.read('word/media/'+c['id']+'.png')

root=ET.fromstring(document);texts=[el.text for el in root.iter('{'+W+'}t')]
expected=[l['text'] for c in DATA['characters'] for s in c['sections'] for l in s['lines']]
assert len(expected)==28 and len(set(expected))==28
assert all(Counter(texts)[line]==1 for line in expected)
assert not any(line['text'] in texts for line in BASE['lines']), 'Only changed new dialogue belongs here'
for path,sha in BASE['hashes'].items():
 if path.startswith('docs/dialogue-review/'):
  assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==sha,path
with ZipFile(OUT/(NAME+'.docx')) as z:
 assert z.testzip() is None
 for path in z.namelist():
  if path.endswith('.xml') or path.endswith('.rels'):ET.fromstring(z.read(path))
 assert z.read('word/media/badger.png')==(OUT/'portraits/badger-round-2.png').read_bytes()
report={'changedLines':28,'plannedPages':len(PAGES)+1,'previousDocumentsUnchanged':True,'otherArtUnchanged':True,'updatedPouchPortraitEmbedded':True,'onlyNewImplementedDialogue':True,'xmlWellFormed':True}
(OUT/'round-2-document-checks.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
