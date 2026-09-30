"""Reusable RTL Word paragraph, table and embedded-image blocks."""

from xml.sax.saxutils import escape

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
