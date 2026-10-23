from pathlib import Path
src=(Path(__file__).resolve().parent/'generar_propuesta.py').read_text()
base=src[:src.index("page(1,'Alianzas comerciales')")]
base=base.replace("R=Path(__file__).resolve().parents[2]","R=Path(__file__).resolve().parents[2]").replace("OUT=Path(__file__).resolve().parent/'propuesta-patrocinio-mundial-de-collage.pdf'","OUT=R/'output/pdf/propuesta-patrocinio-visual.pdf'")
exec(base)
def bars(items,x,y,width,maxval,step=29,highlight=None):
 for label,val,display in items:
  text(label,x,y,110,small)
  c.setFillColor(HexColor('#E5E0D5')); c.roundRect(x+112,y-13,width,10,3,fill=1,stroke=0)
  c.setFillColor(red if label==highlight else blue); c.roundRect(x+112,y-13,width*val/maxval,10,3,fill=1,stroke=0)
  text(display,x+120+width,y,65,small); y-=step
page(1,'Proyecto y oportunidad')
c.drawImage(str(R/'public/logo-mark.png'),40,640,width=85,height=85,mask='auto')
text('MUNDIAL<br/>DE COLLAGE',40,610,515,ParagraphStyle('cover',fontName='Anton',fontSize=54,leading=62,textColor=blue))
sub('PROPUESTA DE PATROCINIO',454)
text('Su marca puede ser parte del Mundial de Collage.',40,407,490,ParagraphStyle('lead',parent=body,fontSize=20,leading=28))
stat(40,301,'685','obras recibidas');stat(216,301,'30','países participantes');stat(391,301,'20','obras por día en la galería virtual')
text('Una galería virtual que renueva su selección diariamente y un encuentro presencial en Mar del Plata. Tres opciones de patrocinio, con presencia en la web, las redes y el evento.',40,232)
c.setFillColor(blue);c.roundRect(40,76,515,70,6,fill=1,stroke=0)
text('BRONCE / SILVER / GOLD',58,130,470,ParagraphStyle('box',parent=body,fontName='Helvetica-Bold',fontSize=15,textColor=cream))
text('Campaña 2026 · Evento previsto: 1 de enero de 2027',58,101,470,ParagraphStyle('boxsmall',parent=small,textColor=cream))
c.showPage()
page(2,'Comunidad y resultados')
title('LA CONVOCATORIA EN NÚMEROS')
stat(40,656,'223.681','visualizaciones acumuladas de la convocatoria')
text('Resultados acumulados de tres publicaciones colaborativas, compartidas también en Facebook.',245,682,300,small)
sub('Personas únicas por post',591)
stat(40,538,'78.290','Post 1'); stat(216,538,'31.307','Post 2'); stat(391,538,'16.119','Post 3')
text('Una misma persona puede haber visto más de un post. Estas cifras no se suman.',40,500,515,small)
sub('Argentina lidera la audiencia',475)
bars([('Argentina',42.4,'42,4 %'),('España',11.9,'11,9 %'),('Chile',9.9,'9,9 %'),('México',7.3,'7,3 %'),('Brasil',5.9,'5,9 %')],40,443,320,50,25,'Argentina')
sub('52,1 % tiene entre 35 y 54 años',295)
# Compact age columns, common zero baseline
ages=[('13-17',.2),('18-24',3.7),('25-34',18.1),('35-44',27.1),('45-54',25),('55-64',16.1),('65+',9.7)]
for i,(label,v) in enumerate(ages):
 x=48+i*72; h=v/30*72
 c.setFillColor(red if i in (3,4) else blue);c.rect(x,173,42,h,fill=1,stroke=0)
 text(str(v).replace('.',',')+' %',x,187+h,60,small);text(label,x,164,65,small)
text('La presencia en la web y la galería se detalla en la página siguiente.',40,133,515,small)
text('Fuentes: capturas aportadas por la organización. Redes: últimas capturas recibidas. Países y edades corresponden a una publicación de referencia, no a toda la campaña. Visualizaciones acumuladas de tres publicaciones; no representan personas únicas. Resultados históricos, sin garantía de rendimiento futuro.',40,91,515,ParagraphStyle('note',parent=small,fontSize=7,leading=9))
c.showPage()
page(3,'Web y galería 3D')
title('SU LOGO EN EL MUNDIAL')
text('Una presencia junto a las obras y a quienes vienen a descubrirlas.',40,688)
sub('Sitio web',643)
stat(40,590,'3.912','visitantes');stat(305,590,'16.982','vistas de página')
sub('Galería 3D · últimos 30 días',527)
stat(40,476,'1.404','aperturas de la galería');stat(216,476,'699','inicios de recorrido');stat(391,476,'787','aperturas de obras')
text('El logo de su marca, con enlace a su sitio, podrá aparecer en un carrusel de patrocinadores en la web y junto al acceso a la galería 3D. La ubicación y la jerarquía dependen del plan.',40,432,515)
# Actual landing capture, showing its header and hero above a proposed carousel.
c.saveState()
clip=c.beginPath();clip.rect(40,194,515,169);c.clipPath(clip,stroke=0)
c.drawImage(str(R/'docs/patrocinio/assets/landing-patrocinio.jpg'),40,73,width=515,height=290)
c.restoreState()
c.setFillColor(HexColor('#EEEAE0'));c.rect(40,105,515,89,fill=1,stroke=0)
text('MARCAS QUE ACOMPAÑAN EL MUNDIAL',58,181,479,ParagraphStyle('carouselheading',parent=small,fontName='Helvetica-Bold',fontSize=8,leading=10,textColor=blue,alignment=1))
for x,variant in [(91,0),(243,1),(395,2)]:
 c.setFillColor(cream);c.roundRect(x,123,115,37,5,fill=1,stroke=0)
 c.setStrokeColor(blue);c.setFillColor(blue);c.setLineWidth(2)
 if variant==0:c.circle(x+21,141,7,fill=0,stroke=1)
 elif variant==1:c.rect(x+14,134,14,14,fill=1,stroke=0)
 else:
  shape=c.beginPath();shape.moveTo(x+14,134);shape.lineTo(x+28,134);shape.lineTo(x+21,149);shape.close();c.drawPath(shape,fill=1,stroke=0)
 text('SU LOGO',x+36,148,73,ParagraphStyle('logoplaceholder',parent=small,fontName='Helvetica-Bold',fontSize=10,leading=12,textColor=blue))
c.setFont('Helvetica',18);c.setFillColor(blue);c.drawString(59,135,'‹');c.drawString(526,135,'›')
text('Ejemplo de ubicación sobre la landing. Logos ilustrativos; no representan marcas asociadas.',40,97,515,ParagraphStyle('mocknote',parent=small,fontSize=7.5,leading=10))
text('Fuente: capturas de la organización recibidas el 9/10/2026. Web: período mostrado en la captura; galería: últimos 30 días. Las aperturas son acciones registradas, no personas únicas. Estas métricas no se suman a las audiencias de redes.',40,77,515,ParagraphStyle('websource',parent=small,fontSize=7,leading=9))
c.showPage()
page(4,'Experiencia y espacios de marca')
title('SU MARCA, EN EVENTO CON FINALISTAS')
text('Un encuentro en Mar del Plata para conocer las obras finalistas y compartir una noche de collage y música.',40,683)
stat(40,613,'80','asistentes estimados');stat(216,613,'4 horas','duración prevista');stat(391,613,'30','obras finalistas')
sub('Exposición, taller y música',542)
text('Vamos a exponer 30 obras finalistas del Mundial de Collage. En otro espacio habrá un taller de collage para que el público también pueda crear. Un DJ acompañará el encuentro con música ambiente.<br/>Cada entrada incluirá un kit con libreta A6, recortes y stickers para usar en el taller y llevarse a casa.',40,510)
sub('Espacios de marca según el plan',405)
y=367
for h,s in [('Web y galería','Logo con enlace a su sitio. La ubicación y el tamaño dependen del plan elegido.'),('Tarjetas interactivas','Logo en las tarjetas digitales que acompañarán el encuentro.'),('Gráfica del evento','Presencia de la marca en la comunicación gráfica del evento.'),('Instagram','Menciones en historias y publicaciones de la campaña. Gold incluye una publicación dedicada a la marca.')]:
 text(h,40,y,170,ParagraphStyle('hh',parent=body,fontName='Helvetica-Bold',textColor=blue));text(s,217,y,335);y-=47
text('El patrocinio ayuda a realizar la exposición y el taller. Las marcas de papeles, adhesivos y herramientas también pueden aportar materiales; acordaremos cómo se usarán y cómo se reconocerá su participación.',40,157)
text('<b>Club Méle</b> · Córdoba 2855, Mar del Plata.<br/><b>1 de enero de 2027</b>: fecha prevista, pendiente de confirmación final.<br/>DJ con música ambiente. Asistencia estimada por la organización.',40,95,515,small)
c.showPage()
page(5,'Planes')
title('ELIJA CÓMO SUMARSE')
text('Tres opciones para acompañar la campaña y el encuentro.',40,689)
cols=[(222,103,'BRONCE','$250.000'),(337,103,'SILVER','$600.000'),(452,103,'GOLD','$1.200.000')]
for x,w,name,price in cols:
 c.setFillColor(red if name=='GOLD' else blue);c.roundRect(x,568,w,95,7,fill=1,stroke=0)
 text(name,x+9,650,w-18,ParagraphStyle('planhead',fontName='Anton',fontSize=20,leading=25,textColor=cream))
 text(price,x+9,612,w-18,ParagraphStyle('price',parent=body,fontName='Helvetica-Bold',fontSize=14,textColor=cream))
 text('ARS',x+9,588,w-18,ParagraphStyle('currency',parent=small,textColor=cream))
text('INCLUYE',40,549,170,ParagraphStyle('legend',parent=small,fontName='Helvetica-Bold',textColor=blue))
def included(cx,cy,yes):
 c.setFillColor(HexColor('#DDE8DD') if yes else HexColor('#E7E4DD'));c.circle(cx,cy,10,fill=1,stroke=0)
 c.setStrokeColor(HexColor('#2C663A') if yes else HexColor('#88847D'));c.setLineWidth(1.8)
 if yes:
  pth=c.beginPath();pth.moveTo(cx-4,cy);pth.lineTo(cx-1,cy-3);pth.lineTo(cx+5,cy+4);c.drawPath(pth)
 else:c.line(cx-4,cy,cx+4,cy)
rows=[('Web y galería',[True,True,True],['Logo + enlace','Logo + enlace','Logo + enlace']),('Jerarquía del logo',[None,None,None],['Base · 1×','Intermedia · 1,5×','Destacada · 2×']),('Tarjetas interactivas',[False,True,True],['','Logo compartido','Logo destacado']),('Gráfica del evento',[False,True,True],['','Secundaria','Principal']),('Historias de Instagram',[True,True,True],['1 colectiva','3 de campaña','6 de campaña']),('Publicaciones de Instagram',[False,True,True],['','1 colectiva','1 colectiva +','1 dedicada']),('Informe de cierre',[True,True,True],['Registro','Registro + métricas','Registro + métricas'])]
y=520
for idx,(label,flags,details) in enumerate(rows):
 if idx%2==0:
  c.setFillColor(HexColor('#ECE9E2'));c.roundRect(40,y-44,515,48,4,fill=1,stroke=0)
 text(label,49,y-13,163,ParagraphStyle('rowlabel',parent=body,fontName='Helvetica-Bold',fontSize=10,leading=14))
 for j,(x,w,_,_) in enumerate(cols):
  cx=x+w/2
  if flags[j] is not None:included(cx,y-13,flags[j])
  else:
   c.setFillColor(blue); size=[8,12,16][j];c.rect(cx-size/2,y-20,size,size,fill=1,stroke=0)
  detail=details[j]
  if idx==5 and j==2:detail='1 colectiva + 1 dedicada'
  text(detail,x+4,y-30,w-8,ParagraphStyle('detail',parent=small,fontSize=8,leading=10,alignment=1))
 y-=50
included(51,145,True);text('Incluido',67,150,80,small)
included(159,145,False);text('No incluido',175,150,100,small)
text('Gold suma presencia destacada en el inicio del sitio y en la galería.',40,127,515,small)
text('Valores de referencia en pesos argentinos. Cantidades para la campaña completa. La proporción del logo es orientativa y se adapta a cada soporte. Una inclusión en historia equivale a una pieza con identificación de la marca.',40,106,515,small)
text('Aceptamos propuestas de aportes en productos o servicios. Entregables, condiciones de pago e impuestos se definen en la cotización final.',40,73,515,small)
c.showPage()
page(6,'Vigencia y contacto')
title('HABLEMOS')
sub('Presencia durante la campaña',672)
text('Desde la activación acordada hasta el <b>1 de enero de 2027</b>, con acciones de Instagram distribuidas durante el período y presencia en el evento previsto, sujeta a su confirmación final.',40,638)
sub('Tres pasos para sumarse',543)
c.setStrokeColor(HexColor('#D9D5CD'));c.setLineWidth(3);c.line(64,478,458,478)
for x,n,h,detail in [(40,'01','Elegimos el plan','Según los objetivos de la marca.'),(217,'02','Definimos el acuerdo','Inversión, entregables, calendario y materiales.'),(394,'03','Lo ponemos en marcha','Al cierre, entregamos un registro de las acciones y, según el plan, las métricas disponibles.')]:
 c.setFillColor(red);c.circle(x+20,478,18,fill=1,stroke=0)
 c.setFillColor(cream);c.setFont('Anton',16);c.drawCentredString(x+20,472,n)
 text(h,x,441,157,ParagraphStyle('timelinehead',parent=body,fontName='Helvetica-Bold',fontSize=12,leading=16,textColor=blue))
 text(detail,x,394,157,ParagraphStyle('timelinedetail',parent=body,fontSize=10,leading=15))
text('Para la próxima convocatoria, prevista para 2027, podremos acordar una renovación. La fecha y el alcance todavía no están definidos.',40,235)
text('La integración en el nombre del evento y la exclusividad por categoría se negocian por separado. Los acuerdos no garantizan visitas, visualizaciones ni ventas.',40,181,515,small)
# Two aligned contact columns with consistent type hierarchy.
c.setStrokeColor(blue);c.setLineWidth(1);c.line(40,156,555,156)
footerlabel=ParagraphStyle('footerlabel',parent=small,fontName='Helvetica-Bold',fontSize=8,leading=10,textColor=HexColor('#69665F'))
footerprimary=ParagraphStyle('footerprimary',parent=body,fontName='Helvetica-Bold',fontSize=11,leading=14,textColor=blue)
footersecondary=ParagraphStyle('footersecondary',parent=small,fontSize=10,leading=13,textColor=ink)
text('CONTACTO COMERCIAL',40,141,250,footerlabel)
text('CORREO Y WEB',305,141,250,footerlabel)
text('Fernando Navarro',40,121,250,footerprimary)
text('+54 9 223 694 0803',40,105,250,footersecondary)
text('Federico Resumil',40,85,250,footerprimary)
text('+54 9 2236 77-5508',40,69,250,footersecondary)
text('<link href="mailto:mundialdecollage@gmail.com" color="#174684">mundialdecollage@gmail.com</link>',305,121,250,footerprimary)
text('<link href="https://www.mundialdecollage.com.ar" color="#202020">www.mundialdecollage.com.ar</link>',305,105,250,footersecondary)
c.save()
print(OUT)
