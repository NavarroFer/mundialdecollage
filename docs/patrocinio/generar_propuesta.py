from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from pathlib import Path
R=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent/'propuesta-patrocinio-mundial-de-collage.pdf'
pdfmetrics.registerFont(TTFont('Anton',str(R/'assets/Anton-Regular.ttf')))
W,H=595.28,841.89
cream=HexColor('#F8F5ED'); ink=HexColor('#202020'); blue=HexColor('#174684'); red=HexColor('#DC302A')
c=canvas.Canvas(str(OUT),pagesize=(W,H)); c.setTitle('Mundial de Collage | Propuesta de patrocinio'); c.setAuthor('Mundial de Collage')
body=ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=17,textColor=ink)
small=ParagraphStyle('small',parent=body,fontSize=8.5,leading=12)
def text(s,x,y,width=499,style=body):
 p=Paragraph(s,style); _,h=p.wrap(width,700); p.drawOn(c,x,y-h); return y-h

def page(n,label):
 c.setFillColor(cream); c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(red); c.rect(40,H-47,36,4,fill=1,stroke=0)
 c.setFont('Helvetica-Bold',9); c.setFillColor(blue); c.drawString(87,H-47,'MUNDIAL DE COLLAGE / '+label.upper())
 c.setStrokeColor(HexColor('#D9D5CD')); c.line(40,48,W-40,48)
 c.setFillColor(ink); c.setFont('Helvetica',8); c.drawString(40,32,'Propuesta para marcas en Argentina · Octubre 2026'); c.drawRightString(W-40,32,f'{n:02d}')
def title(s,y=745):
 return text(s,40,y,515,ParagraphStyle('title',fontName='Anton',fontSize=30,leading=36,textColor=blue))
def sub(s,y):
 return text(s,40,y,499,ParagraphStyle('sub',fontName='Helvetica-Bold',fontSize=14,leading=20,textColor=blue))
def stat(x,y,num,label):
 c.setFillColor(blue); c.setFont('Anton',28); c.drawString(x,y,num); text(label,x,y-12,150,small)

page(1,'Alianzas comerciales')
c.drawImage(str(R/'public/logo-mark.png'),40,615,width=100,height=100,mask='auto',preserveAspectRatio=True)
text('MUNDIAL<br/>DE COLLAGE',40,573,510,ParagraphStyle('cover',fontName='Anton',fontSize=58,leading=66,textColor=blue))
text('PROPUESTA DE PATROCINIO',40,403,510,ParagraphStyle('coverSub',fontName='Helvetica-Bold',fontSize=18,leading=24,textColor=red))
text('Conecte su marca con una comunidad creativa internacional.',40,345,470,ParagraphStyle('coverLead',parent=body,fontSize=20,leading=28))
text('Presencia digital · Comunicación en redes · Experiencia presencial',40,254)
c.setFillColor(blue); c.rect(40,112,515,93,fill=1,stroke=0)
text('BRONCE  /  SILVER  /  GOLD',58,183,475,ParagraphStyle('coverPlans',fontName='Helvetica-Bold',fontSize=15,leading=22,textColor=cream))
text('Mar del Plata, Argentina<br/>Campaña 2026 · Evento previsto: 1 de enero de 2027',58,152,475,ParagraphStyle('coverDate',parent=small,textColor=cream))
c.showPage()
page(2,'Proyecto y oportunidad')
c.drawImage(str(R/'public/logo-mark.png'),40,615,width=76,height=76,mask='auto',preserveAspectRatio=True)
title('EL COLLAGE NOS REÚNE.',590)
text('Asocie su marca a una plataforma de creación artística con participación de 30 países.',40,535,480,ParagraphStyle('lead',parent=body,fontSize=17,leading=24))
stat(40,411,'626','obras recibidas'); stat(216,411,'30','países participantes'); stat(391,411,'20','obras distintas cada día')
sub('Arte, comunidad y una experiencia interactiva',326)
text('El Mundial de Collage reúne obras de distintos lugares del mundo y las acerca al público a través de una galería virtual que renueva su selección diariamente. La experiencia digital se complementará con un encuentro presencial en Mar del Plata.',40,291)
text('Ofrecemos a marcas en Argentina tres alternativas de patrocinio: <b>Bronce, Silver y Gold</b>. Cada nivel ofrece una combinación de presencia digital, comunicación en redes y visibilidad en el evento.',40,197)
text('<b>mundialdecollage.com.ar</b><br/>Presencia de marca durante la campaña y el encuentro presencial.',40,99,499,small)
c.showPage()
page(3,'Comunidad y alcance')
title('UNA CONVOCATORIA CON RESPUESTA')
sub('Sitio web · últimos 30 días de la captura',674)
stat(40,608,'3.205','visitantes'); stat(216,608,'14.087','vistas de página'); stat(391,608,'4,4','vistas por visitante¹')
sub('Tres publicaciones · resultados acumulados',527)
stat(40,469,'216.506','visualizaciones acumuladas'); stat(216,469,'1.152','comentarios'); stat(391,469,'508','reposts')
cs=ParagraphStyle('metricsCell',parent=small,fontSize=9,leading=13)
rs=[['Publicación','Visualizaciones','Espectadores¹','Guardados'],['Convocatoria internacional','138.222','78.195','2,9 mil²'],['Convocatoria edición 2026','49.178','28.272','961'],['Más de 250 obras recibidas','29.106','15.916','563']]
t=Table([[Paragraph(v,ParagraphStyle('mh',parent=cs,textColor=cream,fontName='Helvetica-Bold') if i==0 else cs) for v in r] for i,r in enumerate(rs)],colWidths=[182,109,109,99])
t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),blue),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor('#FFFFFF'),HexColor('#ECE9E2')])]))
_,ht=t.wrap(499,500); t.drawOn(c,40,412-ht)
sub('Una audiencia relevante para marcas en Argentina',265)
text('<b>42,4 %</b> de la audiencia del post de convocatoria internacional corresponde a Argentina. <b>52,1 %</b> tiene entre 35 y 54 años. Estos porcentajes pertenecen a esa pieza, no al conjunto de publicaciones.',40,233)
text('La galería registró <b>1.111 aperturas</b> y <b>619 aperturas de obras</b> en los últimos 30 días del panel. El sitio y las publicaciones ofrecen espacios complementarios para la presencia de marca.',40,164)
text('Fuentes: capturas provistas por la organización el 7/10/2026: Vercel Analytics, panel del proyecto e insights de tres publicaciones colaborativas con tehacefaltacollage_, cruzadas a Facebook. Resultados históricos; no garantizan rendimiento futuro. ¹Viewers por publicación: pueden repetirse entre piezas y no se suman como audiencia única. El total de visualizaciones suma las tres piezas, no personas únicas. ²Valor redondeado en la captura. Vistas por visitante: 14.087 / 3.205.',40,100,499,small)
c.showPage()
page(4,'Experiencia presencial')
title('SU MARCA, EN LA EXPERIENCIA')
text('Un encuentro para descubrir obras, crear collage y compartir una propuesta cultural en Mar del Plata.',40,670,499,ParagraphStyle('eventLead',parent=body,fontSize=16,leading=23))
stat(40,573,'80','asistentes estimados'); stat(216,573,'4 horas','duración prevista'); stat(391,573,'30','obras seleccionadas')
sub('Exhibición y creación en un mismo espacio',490)
text('La galería presencial presentará 30 obras seleccionadas, impresas en papel A4 de buena calidad y montadas sobre cartón gris. El taller de collage estará disponible durante las cuatro horas del encuentro.',40,455)
sub('Un kit incluido con cada entrada',365)
text('Cada entrada incluirá un kit de collage con libreta A6, recortes y stickers de producción propia. Estos materiales acompañarán la participación en el taller y permitirán continuar creando después del encuentro.',40,331)
sub('Una oportunidad para marcas del sector creativo',240)
text('El patrocinio contribuye a la impresión y montaje de las obras y a la producción de los kits. Para marcas de papeles, adhesivos y herramientas, se podrán acordar aportes de materiales y acciones vinculadas al taller, con alcance y reconocimiento definidos por escrito.',40,207)
text('<b>Club Méle</b> · Córdoba 2855, Mar del Plata.<br/><b>Fecha prevista:</b> 1 de enero de 2027, pendiente de confirmación final.<br/>DJ sets y banda en vivo a confirmar. La asistencia indicada es una estimación de la organización.',40,101,499,small)
c.showPage()
page(5,'Espacios de marca')
title('ESPACIOS DE VISIBILIDAD')
y=674
for num,h,s in [('01','Galería virtual y sitio web','Logo con enlace a la marca en el espacio de patrocinadores. Silver suma mayor jerarquía; Gold incorpora presencia destacada en el inicio y en la galería.'),('02','Tarjetas interactivas del evento','Integración del logo en las tarjetas digitales que acompañarán la experiencia del encuentro. La jerarquía visual depende del plan contratado.'),('03','Gráfica presencial','Presencia en las piezas oficiales del evento destinadas a patrocinadores, con mayor tamaño y prioridad para Gold.'),('04','Instagram','Reconocimiento en historias y publicaciones de campaña. Silver suma comunicación colectiva; Gold incorpora una publicación dedicada y mayor frecuencia.')]:
 c.setFillColor(red); c.setFont('Anton',20); c.drawString(40,y-22,num)
 text(h,83,y,450,ParagraphStyle('h',parent=body,fontName='Helvetica-Bold',fontSize=14,leading=20,textColor=blue))
 text(s,83,y-32,450); y-=130
sub('Encuentro presencial en Mar del Plata',145)
text('<b>Club Méle</b> · Córdoba 2855, Mar del Plata, Provincia de Buenos Aires.<br/>Fecha prevista: <b>1 de enero de 2027</b>, pendiente de confirmación final.<br/>Galería con 30 obras seleccionadas y taller de collage durante toda la noche.<br/>DJ sets y banda en vivo a confirmar. Ubicaciones de marca a acordar.',40,114,499,small)
c.showPage()
page(6,'Planes')
title('TRES FORMAS DE SUMARSE')
text('Tres niveles de inversión para acompañar la campaña y el evento. Valores de referencia en pesos argentinos para definir el acuerdo comercial.',40,671)
cell=ParagraphStyle('cell',parent=body,fontSize=9,leading=13)
rows=[['Beneficio','BRONCE','SILVER','GOLD'],['Inversión de referencia','$250.000 ARS','$600.000 ARS','$1.200.000 ARS'],['Web y galería','Logo + enlace en bloque de sponsors','Logo + enlace con prioridad intermedia','Logo + enlace destacado en galería e inicio'],['Tamaño relativo del logo¹','Base 1×','Referencia 1,5×','Referencia 2×'],['Tarjetas interactivas','No incluido','Logo compartido','Logo destacado'],['Gráfica del evento','No incluido','Presencia secundaria','Presencia principal'],['Historias de Instagram²','1 inclusión colectiva','3 inclusiones de campaña','6 inclusiones de campaña'],['Publicaciones de Instagram²','No incluido','1 publicación colectiva','1 colectiva + 1 dedicada'],['Informe de cierre','Registro de presencia','Registro + métricas disponibles','Registro + métricas disponibles']]
data=[[Paragraph(s,ParagraphStyle('head',parent=cell,textColor=cream,fontName='Helvetica-Bold') if i==0 else cell) for s in row] for i,row in enumerate(rows)]
t=Table(data,colWidths=[128,119,123,129]); t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),blue),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor('#FFFFFF'),HexColor('#ECE9E2')]),('LINEBELOW',(0,0),(-1,0),2,red)])); _,th=t.wrap(499,600); t.drawOn(c,40,603-th)
text('¹ Referencias de jerarquía visual, sujetas a adaptación por soporte. ² Cantidades propuestas para la campaña completa, a acordar en la cotización. Una inclusión en historia corresponde a una pieza con identificación de la marca.',40,603-th-17,499,small)
text('<b>Propuesta comercial sujeta a acuerdo.</b> Aportes en productos o servicios: evaluación según su utilidad para la producción. Condiciones de pago y tratamiento de impuestos a definir en la cotización final.',40,141)
c.showPage()
page(7,'Vigencia y contacto')
title('ACTIVEMOS SU PATROCINIO')
sub('Presencia durante la campaña actual',671)
text('La presencia digital se propone desde la activación acordada hasta el <b>1 de enero de 2027</b>. Las acciones de Instagram se distribuirán durante ese período. Se incluye la presencia en el evento previsto para esa fecha, sujeta a confirmación final.',40,638)
sub('Una relación que puede continuar',531)
text('La organización proyecta una segunda convocatoria en 2027. Ofrecemos conversar una extensión de la presencia digital y una renovación para esa próxima edición mediante un acuerdo adicional. Su fecha y alcance todavía no están definidos.',40,498)
sub('Cómo se concreta el patrocinio',397)
text('<b>1.</b> Seleccionamos el plan según los objetivos de la marca.<br/><b>2.</b> Definimos inversión, entregables, calendario y materiales.<br/><b>3.</b> Implementamos la presencia y entregamos un informe de cierre con las acciones realizadas y las métricas disponibles.',40,363)
text('La integración en el nombre del evento y la exclusividad por categoría se negocian como alianzas especiales; no están incluidas en estos planes. Los acuerdos no garantizan cantidades de visitas, visualizaciones ni ventas.',40,258,499,small)
c.setFillColor(blue); c.roundRect(40,80,515,136,8,fill=1,stroke=0)
text('CONTACTO COMERCIAL',58,199,470,ParagraphStyle('ct',fontName='Anton',fontSize=20,leading=26,textColor=cream))
text('Fernando Navarro<br/><link href="mailto:mundialdecollage@gmail.com" color="#FFFFFF">mundialdecollage@gmail.com</link><br/>Tel. +54 9 223 694 0803<br/><link href="https://www.mundialdecollage.com.ar" color="#FFFFFF">www.mundialdecollage.com.ar</link>',58,165,470,ParagraphStyle('contact',parent=body,fontSize=11,leading=18,textColor=cream))
c.save()
print(OUT)
