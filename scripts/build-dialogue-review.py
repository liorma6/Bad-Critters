"""Build an editable RTL Word document and a self-contained reading copy.

Uses only Python's standard library and the already installed Pillow. All dialogue
comes from prepare-dialogue-review.mjs; none of the game's scripts are rewritten.
"""
from pathlib import Path
from xml.sax.saxutils import escape
from xml.etree import ElementTree as ET
import base64, json, zipfile, collections
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'dialogue-review'
DATA = json.loads((OUT / 'review-source.json').read_text(encoding='utf-8'))
ART = OUT / 'portraits'
ART.mkdir(exist_ok=True)

for character in DATA['characters']:
    if character['id'] == 'guide':
        # The existing game emblem, not an invented portrait of the narrator.
        im = Image.new('RGBA', (256, 256))
        draw = ImageDraw.Draw(im)
        draw.rounded_rectangle((0, 0, 255, 255), radius=72, fill='#253f39')
        def quad(a, b, c):
            return [((1-t)**2*a[0]+2*(1-t)*t*b[0]+t*t*c[0],
                     (1-t)**2*a[1]+2*(1-t)*t*b[1]+t*t*c[1]) for t in [i/60 for i in range(61)]]
        draw.polygon(quad((36,128),(128,28),(220,128))+quad((220,128),(128,228),(36,128)), fill='#ecd594')
        draw.ellipse((88,88,168,168), fill='#253f39')
        draw.ellipse((128,104,152,128), fill='#fff9eb')
    else:
        source = Image.open(ROOT / character['art']).convert('RGBA')
        if character['frame']:
            x, y, width, height = character['frame']
            source = source.crop((x, y, x+width, y+height))
        source.thumbnail((300, 360), Image.Resampling.LANCZOS)
        im = Image.new('RGBA', (320, 380))
        im.alpha_composite(source, ((320-source.width)//2, 380-source.height))
    path = ART / f"{character['id']}.png"
    im.save(path)
    character['png'] = path
    character['image_uri'] = 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()

INTRO = [
    'זהו הנוסח הקיים במשחק, מרוכז לפי דמות ובתוכה לפי תיק. אפשר לשכתב ישירות את המשפטים בקובץ Word; מזהה השורה הקטן יעזור להחזיר כל תיקון למקום הנכון.',
    'המסמך כולל את כל ההסתעפויות וגם את פתרונות התעלומות ומשפטי השחזור. הוא מיועד לעבודה על התסריט לפני ההקלטות.',
    'אין לשיחות סדר יחיד: חלקן תלויות בבחירת השחקן או בפעולה שלו. הסדר כאן הוא סדר קריאה לפי מהלך המשחק — מפגש ותצפית, שיחות, חקירה, האשמה ושחזור. הכותרת מעל כל משפט מציינת מתי הוא נאמר.',
    'כל משפט ייחודי מופיע פעם אחת בכל תיק שבו הוא נדרש. משפט משותף מופיע שוב בתיקים הרלוונטיים עם אותו מזהה; יש לתאם את השכתוב בין כל ההופעות שלו. חזרות בתוך אותו תיק מסומנות בהערה.',
]

PAGES = []
for character in DATA['characters']:
    populated = [case for case in character['cases'] if case['lines']]
    absent = [str(case['number']) for case in character['cases'] if not case['lines']]
    absence = ('אין לדמות משפטים בתיקים ' + ', '.join(absent) + '.') if absent else ''
    if character['id'] == 'guide':
        PAGES.append({'character':character, 'cases':populated, 'first':True, 'absence':absence})
    else:
        for i, case in enumerate(populated):
            PAGES.append({'character':character, 'cases':[case], 'first':i==0, 'absence':absence})

def shared_note(line):
    cases = line['sharedCases']
    return ('משותף לתיקים ' + ', '.join(map(str, cases))) if len(cases)>1 else 'משפט ייחודי לתיק'

# A4 HTML pages also serve as the print/PDF master. No external files or fonts.
def h(text): return escape(str(text), {'"':'&quot;'})
def html_profile(character):
    return f'<header class="profile"><img src="{character["image_uri"]}" alt="{h(character["name"])}"><div><div class="eyebrow">חיות שכונה · עותק לשכתוב</div><h1>{h(character["name"])}</h1><p>{h(character["description"])}</p></div></header>'

html = '''<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>חיות שכונה — מסמך לשכתוב</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#dce3dc;color:#263e39;font:16px/1.48 Arial,sans-serif}.sheet{width:210mm;min-height:297mm;margin:20px auto;background:#fffcf6;padding:15mm 17mm 17mm;position:relative;box-shadow:0 3px 22px #18392a25;break-after:page}.profile{display:flex;gap:20px;align-items:center;border-bottom:2px solid #bf955e;padding-bottom:8px;margin-bottom:10px}.profile img{width:75px;height:86px;object-fit:contain}.profile h1{font-size:29px;margin:0}.profile p{margin:3px 0;font-size:14px}.eyebrow{font-size:11px;color:#75614a}h2{font-size:19px;margin:10px 0 2px}.case-count{font-size:12px;color:#667369;margin:0 0 8px}.line{break-inside:avoid;margin-bottom:7px}.line-meta{font-size:11px;color:#68786b;line-height:1.3}.line-meta b{color:#876331}.line-text{font-size:16.5px;line-height:1.38;margin:2px 0 0;color:#1e312d}.code{direction:ltr;unicode-bidi:isolate;font:9px Consolas,monospace;color:#8c9289}.note{font-size:11px;line-height:1.45;border-right:3px solid #c3a579;padding:5px 9px;background:#f3eedf;margin:9px 0 0}.absence{font-size:11px;margin:4px 0;color:#6b7065}.footer{position:absolute;bottom:7mm;right:17mm;left:17mm;display:flex;justify-content:space-between;border-top:1px solid #ddd4c4;padding-top:5px;font-size:10px;color:#7b7d6e}.cover h1{font-size:37px;line-height:1.2;margin:6px 0 12px}.cover .subtitle{font-size:22px;margin:0 0 16px}.cover .intro p{font-size:13px;margin:8px 0}.roster{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.roster figure{margin:0;text-align:center;background:#f1ecdf;border-radius:10px;padding:9px}.roster img{width:100%;height:80px;object-fit:contain}.roster figcaption{font-size:14px;font-weight:bold}.cover table{width:100%;border-collapse:collapse;font-size:12px}.cover th,.cover td{text-align:right;padding:5px 8px;border-bottom:1px solid #d6d2c5}.cover th{background:#e3e7db}.cover .overview{font-size:12px}.print-hint{max-width:210mm;margin:15px auto;padding:0 12px;color:#445b4b;font-size:13px}@page{size:A4;margin:0}@media print{body{background:white}.sheet{margin:0;box-shadow:none;height:297mm;min-height:0}.print-hint{display:none}}@media screen and (max-width:820px){.sheet{width:100%;margin:10px 0;padding:25px 22px 55px;min-height:0}.footer{bottom:14px;right:22px;left:22px}.roster{grid-template-columns:repeat(4,1fr)}.profile{gap:10px}.profile h1{font-size:25px}}
</style><body><p class="print-hint">עותק לקריאה ולהדפסה. לשכתוב נוח השתמשו בקובץ Word המצורף.</p>'''
html += '<section class="sheet cover"><div class="eyebrow">'+h(DATA['date'])+' · '+h(DATA['source'])+'</div><h1>חיות שכונה<br>כל הדמויות. כל המשפטים.</h1><p class="subtitle">עותק לעריכה לפני ההקלטות</p><div class="intro">'+''.join('<p>'+h(p)+'</p>' for p in INTRO)+'</div><div class="roster">'
for character in DATA['characters'][:-1]:
    html += f'<figure><img src="{character["image_uri"]}" alt="{h(character["name"])}"><figcaption>{h(character["name"])}</figcaption></figure>'
html += '</div><table><thead><tr><th>דמות</th><th>תיק 1</th><th>תיק 2</th><th>תיק 3</th></tr></thead><tbody>'
for character in DATA['characters']:
    html += '<tr><td>'+h(character['name'])+'</td>'+''.join('<td>'+str(len(case['lines']))+'</td>' for case in character['cases'])+'</tr>'
html += '</tbody></table><p class="overview">1 · בית בלי פנקס &nbsp; | &nbsp; 2 · מקום שמור לעמוס &nbsp; | &nbsp; 3 · כשיר, עד שנפל</p><p class="overview">133 משפטים ייחודיים במשחק · 258 הופעות במסמך לפי תיק, כולל המשפטים המשותפים.<br>משמרת השכונה היא קריינות בלבד; היא מופיעה בנספח בסוף המסמך עם סמל המשחק.</p><div class="footer"><span>טיוטה לעריכה · כולל פתרונות</span><span>1</span></div></section>'
for page_no, page in enumerate(PAGES,2):
    character=page['character']
    html += '<section class="sheet">'+html_profile(character)
    if page['absence']: html += '<p class="absence">'+h(page['absence'])+'</p>'
    for case in page['cases']:
        html += f'<h2>תיק {case["number"]} · {h(case["title"])}</h2><p class="case-count">{len(case["lines"])} משפטים ייחודיים · מסודרים לפי שלבי המשחק</p>'
        for line in case['lines']:
            html += f'<article class="line" data-line-id="{line["id"]}"><div class="line-meta"><b>{line["number"]:02d}</b> · {h(line["label"])} · {h(shared_note(line))} <span class="code">{line["id"]}</span></div><p class="line-text">{h(line["text"])}</p></article>'
        if case['note']: html += '<p class="note">'+h(case['note'])+'</p>'
    html += '<div class="footer"><span>'+h(character['name'])+' · טיוטה לעריכה · כולל פתרונות</span><span>'+str(page_no)+'</span></div></section>'
html += '</body></html>'
(OUT / 'Neighborhood-Animals-Dialogue-Review.html').write_text(html,encoding='utf-8')

# Minimal OOXML: editable paragraphs, embedded original artwork, right-to-left
# paragraph/complex-script formatting, and actual page-number fields.
NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
def run(text,size=25,bold=False,color='263E39',rtl=True):
    return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'+('<w:b/><w:bCs/>' if bold else '')+f'<w:color w:val="{color}"/><w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'+('<w:rtl/>' if rtl else '<w:rtl w:val="0"/>')+'<w:lang w:val="he-IL" w:bidi="he-IL"/></w:rPr><w:t xml:space="preserve">'+escape(str(text))+'</w:t></w:r>'
def paragraph(text='',style=None,size=25,bold=False,color='263E39',before=0,after=80,keep=False,runs=None,align='right',line=None):
    props=(f'<w:pStyle w:val="{style}"/>' if style else '')+('<w:keepNext/>' if keep else '')+'<w:widowControl/><w:bidi/><w:spacing w:before="'+str(before)+'" w:after="'+str(after)+'"'+(f' w:line="{line}" w:lineRule="exact"' if line else '')+'/><w:jc w:val="'+align+'"/>'
    return '<w:p><w:pPr>'+props+'</w:pPr>'+(runs if runs is not None else run(text,size,bold,color))+'</w:p>'
image_index=0
def picture(character,width=680000,height=807500):
    global image_index
    image_index+=1
    if character['id']=='guide': height=width
    ident=character['id']
    drawing=f'<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{width}" cy="{height}"/><wp:docPr id="{image_index}" name="{ident}" descr="{escape(character["name"])}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="{ident}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="img_{ident}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{width}" cy="{height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
    return paragraph(runs=drawing,after=0,align='center',keep=True)
def cell(content,width=2000):
    return f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>{content}</w:tc>'
def table(rows,widths):
    return '<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+''.join(f'<w:gridCol w:w="{w}"/>' for w in widths)+'</w:tblGrid>'+''.join('<w:tr><w:trPr><w:cantSplit/></w:trPr>'+''.join(cell(c,widths[i]) for i,c in enumerate(row))+'</w:tr>' for row in rows)+'</w:tbl>'
def profile(character,first):
    text=paragraph('חיות שכונה · עותק לשכתוב',size=18,color='75614A',after=35)
    text+=paragraph(character['name'],style='Heading1' if first else None,size=42,bold=True,after=45,keep=True)
    text+=paragraph(character['description'],size=23,after=40,keep=True)
    return table([[picture(character),text]],[1200,8766])+paragraph('',size=2,after=40,line=20)
def pagebreak(): return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

body=paragraph(DATA['date']+' · '+DATA['source'],size=19,color='75614A',after=100)
body+=paragraph('חיות שכונה',size=58,bold=True,after=40)+paragraph('כל הדמויות. כל המשפטים.',size=44,bold=True,after=60)+paragraph(DATA['subtitle'],size=32,after=170)
for p in INTRO: body+=paragraph(p,size=23,after=95)
rows=[]
for start in [0,4]:
    rows.append([picture(c,650000,771875)+paragraph(c['name'],size=21,bold=True,align='center',after=90) for c in DATA['characters'][start:start+4]])
body+=table(rows,[2490]*4)+paragraph('',size=2,after=70,line=20)
rows=[[paragraph(t,size=21,bold=True,after=45) for t in ['דמות','תיק 1','תיק 2','תיק 3']]]
for c in DATA['characters']:
    rows.append([paragraph(c['name'],size=20,after=25)]+[paragraph(str(len(case['lines'])),size=20,after=25) for case in c['cases']])
body+=table(rows,[4200,1920,1920,1920])
body+=paragraph('1 · בית בלי פנקס | 2 · מקום שמור לעמוס | 3 · כשיר, עד שנפל',size=20,before=100,after=70)
body+=paragraph('133 משפטים ייחודיים במשחק · 258 הופעות לפי תיק, כולל משפטים משותפים. הקריינות מופיעה בנספח האחרון עם סמל המשחק.',size=20,after=0)
for page in PAGES:
    c=page['character'];body+=pagebreak()+profile(c,page['first'])
    if page['absence']: body+=paragraph(page['absence'],size=19,color='68786B',after=65)
    for case in page['cases']:
        body+=paragraph(f'תיק {case["number"]} · {case["title"]}',style='Heading2',size=31,bold=True,before=50,after=35,keep=True)
        body+=paragraph(f'{len(case["lines"])} משפטים ייחודיים · לפי שלבי המשחק',size=19,color='68786B',after=110,keep=True)
        for line in case['lines']:
            meta=f'{line["number"]:02d} · {line["label"]} · {shared_note(line)}  '
            body+=paragraph(runs=run(meta,size=17,color='68786B')+run(line['id'],size=15,color='8C9289',rtl=False),after=20,keep=True,line=220)
            body+=paragraph(line['text'],size=25,after=85,line=330)
        if case['note']: body+=paragraph(case['note'],size=18,color='75614A',before=60,after=70)
sect='<w:sectPr><w:footerReference w:type="default" r:id="footer1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="965" w:bottom="850" w:left="965" w:header="300" w:footer="380" w:gutter="0"/><w:bidi/></w:sectPr>'
document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+sect+'</w:body></w:document>'
styles='''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="25"/><w:szCs w:val="25"/><w:lang w:val="he-IL" w:bidi="he-IL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr></w:style></w:styles>'''
footer='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr '+NS+'>'+paragraph(runs=run('חיות שכונה · טיוטה לעריכה · כולל פתרונות    |    ',size=18,color='7B7D6E')+'<w:fldSimple w:instr="PAGE">'+run('1',size=18,color='7B7D6E')+'</w:fldSimple>',after=0,align='center')+'</w:ftr>'
settings='<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>'
rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="img_{c["id"]}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{c["id"]}.png"/>' for c in DATA['characters'])+'<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="settings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="footer1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'
types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'+''.join(f'<Override PartName="/word/{part}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.{kind}+xml"/>' for part,kind in [('document','document.main'),('styles','styles'),('settings','settings'),('footer1','footer')])+'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'
package_rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="core" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'
core='<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+escape(DATA['title'])+'</dc:title><dc:subject>תסריט מלא לעריכה לפי דמות ותיק</dc:subject><dc:description>הנוסח הקיים במשחק. כולל פתרונות; עותק לשכתוב לפני הקלטות.</dc:description></cp:coreProperties>'
parts={'[Content_Types].xml':types,'_rels/.rels':package_rels,'word/document.xml':document,'word/styles.xml':styles,'word/settings.xml':settings,'word/footer1.xml':footer,'word/_rels/document.xml.rels':rels,'docProps/core.xml':core}
for value in parts.values(): ET.fromstring(value)
docx=OUT / 'Neighborhood-Animals-Dialogue-Review.docx'
with zipfile.ZipFile(docx,'w',zipfile.ZIP_DEFLATED) as archive:
    for name,value in parts.items(): archive.writestr(name,value.encode('utf-8'))
    for c in DATA['characters']: archive.write(c['png'],f'word/media/{c["id"]}.png')
with zipfile.ZipFile(docx) as archive: assert archive.testzip() is None
texts=[e.text for e in ET.fromstring(document).iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')]
expected=collections.Counter(line['text'] for c in DATA['characters'] for case in c['cases'] for line in case['lines'])
found=collections.Counter(texts)
assert all(found[text]==count for text,count in expected.items())
report={'characters':len(DATA['characters']),'illustratedCharacters':8,'narratorEmblem':True,'uniqueLines':DATA['uniqueLines'],'perCaseLineEntries':sum(expected.values()),'plannedPages':len(PAGES)+1,'docxXmlValid':True,'allExactDialoguePresent':True,'files':[docx.name,'Neighborhood-Animals-Dialogue-Review.html']}
(OUT/'document-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
