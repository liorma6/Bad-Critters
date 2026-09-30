import {BUILDINGS,ENTRANCES} from './scene-layout.js';
import {artAssets} from './art-assets.js';
let c;let grain;
const nightArt=new Map();
const mix=(a,b,t)=>a+(b-a)*t;
function tone(a,b,t){const rgb=[1,3,5].map(i=>Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)));return `rgb(${rgb.join(',')})`;}
function ellipse(x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
function poly(points,fill,stroke,width=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function line(points,color,width=2){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function rect(x,y,w,h,fill,r=0){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();}
function ink(text,x,y,size=15,color='#f7e7bd'){c.font=`700 ${size}px Arial`;c.textAlign='center';c.textBaseline='middle';c.direction='rtl';c.fillStyle=color;c.fillText(text,x,y);}
export function ground(context,night,t,dusk=0){
 c=context;
 const gradient=c.createLinearGradient(50,0,850,760);gradient.addColorStop(0,tone(dusk>.15?'#efd095':'#e9d0a0','#3c686b',night));gradient.addColorStop(.6,tone(dusk>.15?'#d8a477':'#d3b785','#2b5057',night));gradient.addColorStop(1,tone(dusk>.15?'#b78766':'#c7ac7d','#294f51',night));c.fillStyle=gradient;c.fillRect(0,0,1000,760);
 // Irregular islands of plants leave broad, continuous walking space.
 for(const [x,y,rx,ry]of [[65,170,100,113],[920,144,113,137],[200,574,159,116],[897,630,123,83],[30,684,92,76]])ellipse(x,y,rx,ry,tone('#aab07a','#2c5851',night));
 const road=(points,w)=>{c.beginPath();c.moveTo(...points[0]);c.bezierCurveTo(...points[1],...points[2],...points[3]);c.strokeStyle=tone('#ad9672','#234b51',night);c.lineWidth=w+5;c.lineCap='round';c.stroke();c.strokeStyle=tone('#e4cca3','#527779',night);c.lineWidth=w;c.stroke();};
 for(const id of ['bakery','center','home']){const e=ENTRANCES[id];road([[e.x,407],[e.x-6,370],[e.x+5,345],[e.x,e.y-13]],47);}
 road([[483,780],[490,725],[482,700],[511,669]],73);
 road([[647,398],[686,476],[672,643],[804,688]],49);
 road([[363,400],[363,464],[335,648],[511,678]],50);
 road([[310,410],[305,459],[298,525],[244,549]],39);
 road([[-25,397],[290,362],[711,422],[1025,389]],90);
 // Individual paving stones have broken, staggered joints; dust softens their edges.
 for(let row=0;row<3;row++)for(let i=0;i<30;i++){const x=i*38+(row%2)*19,y=371+row*24+Math.sin(x*.008)*5;line([[x,y],[x+29,y+1]],tone('#c3ad86','#43666a',night),1);if(i%2===0)line([[x+32,y],[x+32,y+18]],tone('#c3ad86','#43666a',night),1);}
 if(!grain){grain=document.createElement('canvas');grain.width=128;grain.height=128;const g=grain.getContext('2d');for(let i=0;i<1400;i++){g.fillStyle=i%3?'#513f2110':'#fff7d326';g.fillRect((i*67)%128,(i*43.71)%128,i%7===0?2:1,1);}}
 c.fillStyle=c.createPattern(grain,'repeat');c.fillRect(0,0,1000,760);
 // Worn patch at the gathering bell and a small drain in the public lane.
 ellipse(490,409,60,24,tone('#cfb88e','#3b6268',night));ellipse(616,401,15,8,'#42666855');for(let i=0;i<5;i++)line([[606+i*5,397],[606+i*5,405]],'#3c5b5a',1.5);
 for(const [x,y]of [[343,297],[667,656],[885,352],[56,416]]){ellipse(x,y,8,3,'#4a594033');poly([[x-5,y-3],[x+3,y-6],[x+7,y-2],[x+2,y+1]],tone('#cbb18a','#58726d',night));}
 // A few scattered leaves; their motion stays below the evidence hierarchy.
 for(let i=0;i<5;i++){const x=50+i*192+Math.sin(t*.17+i)*10,y=427+(i%2)*12;ellipse(x,y,3.5,1.2,tone('#aa8049','#7d835d',night));}
}
export function plant(context,x,y,scale,t,kind='olive',night=0){
 c=context;c.save();c.translate(x,y);c.scale(scale,scale);const wind=Math.sin(t*1.1+x*.02)*1.8;
 ellipse(14,4,39,12,'#143b4035');
 if(kind==='cypress'){
  line([[0,0],[1,-81]],'#7e6746',5);poly([[-17,-8],[-21,-37],[-12,-68],[0,-105],[12,-65],[20,-34],[17,-9],[0,-1]],tone('#356758','#163f43',night));
  for(let i=0;i<25;i++){const yy=-8-i*3.5,ww=(1-i/29)*14;line([[-ww+Math.sin(i)*3,yy],[wind*.3,yy-10],[ww*.7,yy-2]],tone(i%2?'#66805c':'#496f58','#2b5550',night),2.5);}
 }else{
  c.beginPath();c.moveTo(-2,0);c.bezierCurveTo(2,-22,-5,-36,wind+4,-58);c.strokeStyle='#816641';c.lineWidth=8;c.lineCap='round';c.stroke();
  line([[0,-28],[-24+wind,-58]],'#78664b',5);line([[2,-36],[25+wind,-65]],'#78664b',4);
  const palette=kind==='lemon'?['#315c43','#49754a','#6c8b4e','#8a9d56']:['#385f50','#567969','#78917a','#96a186'];
  for(let i=0;i<41;i++){const a=i*2.399,rad=Math.sqrt(i/41)*42,px=Math.cos(a)*rad+wind,py=-65+Math.sin(a)*rad*.66;ellipse(px+4,py+5,12,9,tone(palette[i%4],'#284f4b',night));ellipse(px,py,11,7,tone(palette[(i+1)%4],'#3b6153',night));}
  for(let i=0;i<24;i++){const px=Math.sin(i*7)*37+wind,py=-65+Math.cos(i*4)*24;line([[px-3,py+2],[px+3,py-2]],tone('#a9b38b','#718e73',night),1.5);}
  if(kind==='lemon')for(let i=0;i<7;i++)ellipse(Math.sin(i*6)*29,-65+Math.cos(i*2)*22,3,4,tone('#eab847','#939951',night));
 }
 c.restore();
}
export const TREES=[{x:25,y:293,s:.88,kind:'olive'},{x:985,y:295,s:1,kind:'cypress'},{x:347,y:141,s:.63,kind:'cypress'},{x:675,y:132,s:.72,kind:'olive'},{x:21,y:728,s:1.25,kind:'lemon'},{x:973,y:740,s:1.25,kind:'olive'},{x:89,y:487,s:.65,kind:'lemon'},{x:268,y:491,s:.55,kind:'olive'}];
export function garden(context,s,t,night){
 c=context;
 c.beginPath();c.moveTo(57,494);c.bezierCurveTo(88,465,264,470,300,487);c.bezierCurveTo(335,535,316,620,276,644);c.bezierCurveTo(178,670,63,648,49,611);c.closePath();c.fillStyle=tone('#768e5b','#2c5c50',night);c.fill();c.strokeStyle=tone('#b3ad7f','#526f5d',night);c.lineWidth=8;c.stroke();
 c.beginPath();c.moveTo(302,514);c.bezierCurveTo(242,507,236,564,196,585);c.bezierCurveTo(152,610,110,580,55,607);c.strokeStyle=tone('#d4bd91','#577976',night);c.lineWidth=25;c.stroke();
 for(const [x,y,w]of [[90,535,75],[203,626,62]]){
  poly([[x-7,y-7],[x+w,y-7],[x+w+6,y+10],[x,y+10]],tone('#b19d71','#43655b',night));rect(x,y-12,w,17,tone('#7c744c','#344f46',night),4);
  for(let i=0;i<15;i++){const px=x+(i*17)%w,py=y-13+Math.sin(i)*2;line([[px,y],[px+Math.sin(t*1.5+i)*2,py-13]],'#4f7254',1.5);ellipse(px-3,py-4,5,2.7,tone('#8a9d5c','#3c6e56',night));ellipse(px+3,py-8,5,2.7,tone('#b0af64','#6b8b59',night));}
 }
 // The snake's resting bench shares this anchor with its painted coiling pose.
 for(let j=0;j<3;j++)poly([[88,569+j*6],[147,566+j*6],[154,571+j*6],[94,575+j*6]],tone(j%2?'#ac8049':'#c39859','#5e7056',night),'#6d704c',1);
 line([[96,580],[96,596]],'#405a47',4);line([[145,578],[145,593]],'#405a47',4);line([[92,570],[91,548],[144,546],[146,567]],'#52644a',3);line([[93,551],[143,549]],'#c2995b',5);line([[94,560],[144,558]],'#b4894b',4);
}
export function gardenSign(context,s){
 c=context;
 line([[282,574],[282,525]],'#745f3e',4);c.save();c.translate(282,518);c.rotate(-.09);rect(-40,-14,80,30,'#cfb588',3);ink(s.index>1?'לזכר עמוס':'לא לגרור כיסאות',0,1,12,'#4a4939');c.restore();
}
export function structure(context,id,night,t,variant=id){
 c=context;const b=BUILDINGS[id],img=artAssets[variant]||artAssets[id];if(!img)return;
 const shadow=c.createRadialGradient(b.x+b.w*.55,b.depth,8,b.x+b.w*.55,b.depth,b.w*.52);shadow.addColorStop(0,'#17474a55');shadow.addColorStop(1,'#17474a00');ellipse(b.x+b.w*.55,b.depth+3,b.w*.51,20,shadow);
 c.drawImage(img,b.x,b.y,b.w,b.h);
 if(night>.01){
  if(!nightArt.has(variant)){const tile=document.createElement('canvas');tile.width=Math.ceil(b.w*2);tile.height=Math.ceil(b.h*2);const g=tile.getContext('2d');g.filter='brightness(.76) saturate(.86)';g.drawImage(img,0,0,tile.width,tile.height);nightArt.set(variant,tile);}
  c.save();c.globalAlpha=night;c.drawImage(nightArt.get(variant),b.x,b.y,b.w,b.h);c.restore();
 }
 if(id==='bakery')ink('פירורים',b.sign.x,b.sign.y,22,night?'#d7c399':'#714829');
 // Other sign plates are added as actual text and kept sparse; no generated lettering.
 if(id!=='bakery'){const text={center:'המתנ״ס',home:'מרגלית',delivery:'משלוחים',shed:'מחסן זמני'}[id];c.save();c.translate(b.sign.x,b.sign.y);c.rotate(id==='shed'||id==='delivery'?.075:id==='center'?.035:0);ink(text,0,1,b.sign.size,night?'#dfc590':'#59432b');c.restore();}
 // Canvas trim adds a tiny breeze to the fixed painted awning.
 if(id==='bakery'){c.beginPath();c.moveTo(62,178);c.quadraticCurveTo(156,184+Math.sin(t*1.7)*1.2,253,182);c.strokeStyle='#fbe2aa66';c.lineWidth=1.5;c.stroke();}
 if(night>.03){const e=ENTRANCES[id],g=c.createRadialGradient(e.x,e.y-15,3,e.x,e.y,70);g.addColorStop(0,`rgba(255,192,76,${night*.34})`);g.addColorStop(1,'#ffb34500');c.save();c.globalCompositeOperation='screen';c.fillStyle=g;c.fillRect(e.x-75,e.y-65,150,125);c.restore();}
}
export function lantern(context,x,y,night,t){
 c=context;ellipse(x+5,y+4,14,5,'#1c4c4933');line([[x,y],[x,y-76],[x+13,y-84]],'#325551',4);poly([[x+4,y-88],[x+22,y-88],[x+19,y-66],[x+8,y-66]],night>.2?'#f6c571':'#ecce8d','#47605a',2);poly([[x+1,y-88],[x+12,y-97],[x+24,y-88]],'#47605a');
 if(night>.03){const light=c.createRadialGradient(x+13,y-65,1,x+13,y-17,115);light.addColorStop(0,`rgba(255,204,117,${night*.5})`);light.addColorStop(.5,`rgba(243,181,76,${night*.14})`);light.addColorStop(1,'#efb04800');c.fillStyle=light;c.fillRect(x-108,y-131,239,219);ellipse(x+13,y-8,49,16,`rgba(255,206,122,${night*.1})`);}
}
export function foreground(context,night){
 c=context;
 // Fragments frame the scene, leaving the central entrance and interaction targets open.
 for(const [x,y,w]of [[67,714,150],[795,718,122]]){poly([[x,y],[x+w,y-3],[x+w,y+18],[x,y+20]],tone('#a78e65','#3e5d58',night));poly([[x-3,y],[x+w+3,y-4],[x+w+4,y+1],[x-3,y+5]],tone('#e0c49a','#6c8980',night));for(let i=15;i<w;i+=31)line([[x+i,y+4],[x+i,y+18]],tone('#897c5f','#31504e',night),1);}
}
