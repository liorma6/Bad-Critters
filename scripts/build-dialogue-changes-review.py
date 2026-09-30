"""Create the changes-only document; use original embedded art without editing it."""
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED
from collections import Counter
import base64, json, hashlib
from rtl_docx_blocks import NS, run, paragraph, table, profile, pagebreak

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'dialogue-review'
NAME='Neighborhood-Animals-Dialogue-Changes-Review'
ORIGINAL=OUT/'Neighborhood-Animals-Dialogue-Review.docx'
original_hash=hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()
DATA=json.loads((OUT/'changes-review-source.json').read_text(encoding='utf-8'))
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
for c in DATA['characters']:
    c['image_uri']='data:image/png;base64,'+base64.b64encode((OUT/c['portrait']).read_bytes()).decode()

INTRO=[
 'במסמך הזה מופיעים רק 64 המשפטים ששונו בסבב העריכה. זהו הנוסח שהוטמע בפועל במשחק ובתסריטי ההקלטה.',
 'בכל דמות יש סעיף נפרד למשפטים משותפים, ולאחריו המשפטים ששונו בכל תיק. משפט משותף מופיע כאן פעם אחת בלבד, גם אם הוא נשמע בכמה תיקים.',
 'מעל כל משפט מופיעים המזהה וההקשר. הוראת ביצוע מופיעה רק כשיש בה תועלת להקלטה. הסדר בתוך שיחות לבחירה תלוי בשחקן.',
 'המסמך כולל מידע מהחקירה. מסמך הביקורת המקורי נשמר בנפרד ללא שינוי.',
]

# Longer rewritten roles get a common-lines page and a case-specific page.
PAGES=[]
for c in DATA['characters']:
    if c['id'] in ['snake','turtle']:
        PAGES.extend([{'character':c,'sections':[s for s in c['sections'] if s['index']==0],'first':True},
                      {'character':c,'sections':[s for s in c['sections'] if s['index']!=0],'first':False}])
    else: PAGES.append({'character':c,'sections':c['sections'],'first':True})

def h(s): return escape(str(s),{'"':'&quot;'})
def scope(line): return 'בתיקים '+', '.join(map(str,line['cases'])) if len(line['cases'])>1 else 'בתיק '+str(line['cases'][0])
def counts(c): return [sum(len(s['lines']) for s in c['sections'] if s['index']==i) for i in range(4)]

html='''<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>חיות שכונה — המשפטים ששונו</title><style>
*{box-sizing:border-box}body{margin:0;background:#e2e6de;color:#263e39;font:16px/1.45 Arial,sans-serif}.sheet{width:210mm;min-height:297mm;margin:20px auto;background:#fffcf6;padding:15mm 17mm 17mm;position:relative;box-shadow:0 3px 22px #18392a20;break-after:page}.profile{display:flex;gap:20px;align-items:center;border-bottom:2px solid #bf955e;padding-bottom:10px;margin-bottom:12px}.profile img{width:82px;height:100px;object-fit:contain}.profile h1{font-size:29px;margin:0}.profile p{margin:3px 0;font-size:14px}.eyebrow{font-size:11px;color:#75614a}h2{font-size:19px;margin:15px 0 9px}.line{break-inside:avoid;margin:0 0 14px}.line-meta{font-size:11px;color:#68786b;line-height:1.3}.line-text{font-size:17px;line-height:1.4;margin:3px 0;color:#1e312d}.code{direction:ltr;unicode-bidi:isolate;font:10px Consolas,monospace;color:#7b7f71}.hint{font-size:11px;line-height:1.4;color:#8b6b45;margin:3px 0}.footer{position:absolute;bottom:7mm;right:17mm;left:17mm;display:flex;justify-content:space-between;border-top:1px solid #ddd4c4;padding-top:5px;font-size:10px;color:#7b7d6e}.cover h1{font-size:38px;line-height:1.2;margin:12px 0}.subtitle{font-size:21px;margin:0 0 22px}.cover p{font-size:15px;margin:12px 0}.cover table{width:100%;border-collapse:collapse;font-size:14px;margin:25px 0}.cover th,.cover td{text-align:right;padding:10px 8px;border-bottom:1px solid #d6d2c5}.cover th{background:#e3e7db}.callout{background:#f0eadb;padding:14px 17px;border-right:3px solid #b78c54}.cover small{font-size:12px;color:#647064}@page{size:A4;margin:0}@media print{body{background:white}.sheet{margin:0;box-shadow:none;height:297mm;min-height:0}}@media screen and (max-width:820px){.sheet{width:100%;margin:10px 0;padding:25px 22px 55px;min-height:0}.footer{bottom:14px;right:22px;left:22px}.profile{gap:10px}.profile h1{font-size:25px}}
</style><body>'''
html+='<section class="sheet cover"><div class="eyebrow">'+h(DATA['date'])+' · מסמך שינויים בלבד</div><h1>חיות שכונה<br>המשפטים ששונו</h1><div class="subtitle">'+h(DATA['subtitle'])+'</div>'
html+=''.join('<p>'+h(p)+'</p>' for p in INTRO)
html+='<table><thead><tr>'+''.join('<th>'+h(t)+'</th>' for t in ['דמות','משותפים','תיק 1','תיק 2','תיק 3','סך הכול'])+'</tr></thead><tbody>'
for c in DATA['characters']: html+='<tr><td>'+h(c['name'])+'</td>'+''.join('<td>'+str(n)+'</td>' for n in counts(c)+[c['count']])+'</tr>'
html+='</tbody></table><p class="callout">זלמן — גיימר ופיקאפר כושל שמאבד ביטחון בשיחה אמיתית.<br>צביקה — שליח מצוברח ושחוק שעוזר תוך תלונות.<br>עמוס — ביטחון של בוס מאיים, במאבקים על עניינים זעירים.</p><small>המספרים סופרים מזהי משפטים ייחודיים. לעמוס נשאר תפקיד מלא של חמישה משפטים בכל אחד משני תיקיו; שלושה מהם משותפים.</small><div class="footer"><span>חיות שכונה · שינויים שהוטמעו</span><span>1</span></div></section>'
for number,page in enumerate(PAGES,2):
 c=page['character'];html+='<section class="sheet"><header class="profile"><img src="'+c['image_uri']+'" alt="'+h(c['name'])+'"><div><div class="eyebrow">סבב עריכת דיאלוגים · הנוסח שהוטמע</div><h1>'+h(c['name'])+'</h1><p>'+h(c['description'])+'</p></div></header>'
 for s in page['sections']:
  html+='<section class="group"><h2>'+h(s['title'])+'</h2>'
  for line in s['lines']:
   html+='<article class="line" data-line-id="'+line['id']+'"><div class="line-meta"><span class="code">'+line['id']+' · v'+str(line['version'])+'</span> · '+h(line['context'])+' · '+h(scope(line))+'</div><p class="line-text">'+h(line['text'])+'</p>'
   if line['hint']:html+='<p class="hint">ביצוע: '+h(line['hint'])+'</p>'
   html+='</article>'
  html+='</section>'
 html+='<div class="footer"><span>'+h(c['name'])+' · שינויים שהוטמעו</span><span>'+str(number)+'</span></div></section>'
html+='</body></html>'
(OUT/(NAME+'.html')).write_text(html,encoding='utf-8')

body=paragraph(DATA['date']+' · מסמך שינויים בלבד',size=20,color='75614A',after=130)
body+=paragraph('חיות שכונה',size=58,bold=True,after=50)+paragraph('המשפטים ששונו',size=46,bold=True,after=100)+paragraph(DATA['subtitle'],size=29,after=200)
for p in INTRO:body+=paragraph(p,size=25,after=140)
rows=[[paragraph(t,size=20,bold=True,after=60) for t in ['דמות','משותפים','תיק 1','תיק 2','תיק 3','סך הכול']]]
for c in DATA['characters']:rows.append([paragraph(c['name'],size=22,after=90)]+[paragraph(str(n),size=22,after=90) for n in counts(c)+[c['count']]])
body+=table(rows,[2560,1480,1480,1480,1480,1480])
body+=paragraph('זלמן — גיימר ופיקאפר כושל שמאבד ביטחון בשיחה אמיתית.',size=25,before=180,after=70)
body+=paragraph('צביקה — שליח מצוברח ושחוק שעוזר תוך תלונות.',size=25,after=70)
body+=paragraph('עמוס — ביטחון של בוס מאיים, במאבקים על עניינים זעירים.',size=25,after=160)
body+=paragraph('המספרים סופרים מזהי משפטים ייחודיים. לעמוס נשאר תפקיד מלא של חמישה משפטים בכל אחד משני תיקיו; שלושה מהם משותפים.',size=22,after=0)
for page in PAGES:
 c=page['character'];body+=pagebreak()+profile(c,page['first'])
 for s in page['sections']:
  body+=paragraph(s['title'],style='Heading2',size=31,bold=True,before=110,after=120,keep=True)
  for line in s['lines']:
   body+=paragraph(runs=run(line['id']+' · v'+str(line['version']),size=18,color='7B7F71',rtl=False)+run(' · '+line['context']+' · '+scope(line),size=18,color='68786B'),after=40,keep=True)
   body+=paragraph(line['text'],size=26,after=40 if line['hint'] else 135,keep=bool(line['hint']),line=350)
   if line['hint']:body+=paragraph('ביצוע: '+line['hint'],size=19,color='8B6B45',after=135)

with ZipFile(ORIGINAL) as old:
 original_document=ET.fromstring(old.read('word/document.xml'))
 sect=ET.tostring(original_document.find('.//{'+W+'}sectPr'),encoding='unicode')
 document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+sect+'</w:body></w:document>'
 core='<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+escape(DATA['title'])+'</dc:title><dc:subject>משפטים ששונו בלבד, לפי דמות ותיק</dc:subject><dc:description>הנוסח החדש שהוטמע במשחק; בלי נוסחים קודמים ובלי משפטים שלא השתנו.</dc:description></cp:coreProperties>'
 ET.fromstring(document);ET.fromstring(core)
 with ZipFile(OUT/(NAME+'.docx'),'w',ZIP_DEFLATED) as new:
  for name in old.namelist():new.writestr(name,document.encode('utf-8') if name=='word/document.xml' else core.encode('utf-8') if name=='docProps/core.xml' else old.read(name))
  for c in DATA['characters']:
   assert old.read('word/media/'+c['id']+'.png')==(OUT/c['portrait']).read_bytes(),'Art must remain identical'

root=ET.fromstring(document)
texts=[el.text for el in root.iter('{'+W+'}t')]
expected=[line['text'] for c in DATA['characters'] for s in c['sections'] for line in s['lines']]
assert len(expected)==64 and len(set(expected))==64
assert all(Counter(texts)[line]==1 for line in expected)
baseline=json.loads((ROOT/'.cache/dialogue-edit-baseline.json').read_text(encoding='utf-8'))
assert not any(line['text'] in texts for line in baseline['lines']), 'No old or unchanged dialogue may appear'
assert hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()==original_hash
with ZipFile(OUT/(NAME+'.docx')) as archive:assert archive.testzip() is None
report={'changedLines':64,'plannedPages':len(PAGES)+1,'originalDocxUnchanged':True,'originalArtUnchanged':True,'onlyNewImplementedDialogue':True,'xmlWellFormed':True}
(OUT/'changes-document-checks.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
