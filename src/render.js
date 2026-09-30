import {sceneState} from './incidents.js';
import {drawSupporting} from './supporting-sprites.js';
import {crimeSceneQueue} from './crime-scenes.js';
import {LOCATIONS,RESIDENTS,SUPPORTING} from './content.js';
import {dist} from './simulation.js';
import {Animator} from './animation.js';
import {drawCharacter,CHARACTER_HEIGHT,characterBounds} from './characters.js';
import {BUILDINGS,ENTRANCES,artHit} from './scene-layout.js';
import {ground,garden,gardenSign,plant,TREES,structure,lantern,foreground} from './environment.js';
const ink='#435449';
let ctx;
const animator=new Animator();
const evidencePoint=(s,id)=>id==='garden'?{x:190,y:544}:id==='home'&&sceneState(s).burned?{x:830,y:320}:ENTRANCES[id];
function ellipse(x,y,rx,ry,fill,stroke){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function rect(x,y,w,h,fill,r=0,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function path(points,fill,stroke=ink,width=2){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}}
function text(str,x,y,size=15,color=ink,weight=500){ctx.font=`${weight} ${size}px Arial`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction='rtl';ctx.fillText(str,x,y);}
function chair(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);path([[-8,0],[-8,17],[8,17],[8,0]],null,'#715d45',3);rect(-10,-9,20,14,'#d0ab69',3,'#766748');path([[-10,10],[10,10]],null,'#d0ab69',7);ctx.restore();}
function compressor(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);rect(-22,-17,44,33,'#dbe0d3',4,ink);ellipse(5,0,12,12,'#a6b6ab',ink);for(let i=0;i<4;i++){ctx.save();ctx.translate(5,0);ctx.rotate(i*Math.PI/2);ellipse(0,-5,3,7,'#6d8276');ctx.restore();}path([[-16,-10],[-16,10]],null,'#91a399',2);ctx.restore();}
export function portrait(r){
 return `<canvas class="resident-portrait" data-portrait="${r.id}" width="180" height="210" role="img" aria-label="${r.name}"></canvas>`;
}
export function renderPortraits(){
 for(const tile of document.querySelectorAll('canvas[data-portrait]')){
  const r=RESIDENTS.find(r=>r.id===tile.dataset.portrait);
  const c=tile.getContext('2d');c.clearRect(0,0,180,210);
  if(!r){if(['badger','hedgehog'].includes(tile.dataset.portrait))drawSupporting(c,tile.dataset.portrait,20,0,140,210);continue;}
  drawCharacter(c,r,{x:r.id==='snake'?65:r.id==='turtle'?90:64,y:192,walk:0,gait:0,watch:0,facing:1,seed:0},0,r.id==='turtle'?1.55:1.65,false);
 }
}
let renderTotal=0,renderFrames=0;
export function render(canvas,s,dt=1/60,playing=true){
 const began=performance.now();animator.update(s,dt,playing);const t=animator.clock;
 ctx=canvas.getContext('2d');const c=ctx,dpr=Math.min(devicePixelRatio||1,2),width=canvas.clientWidth,desired=Math.round(width*dpr);
 if(canvas.width!==desired){canvas.width=desired;canvas.height=Math.round(desired*.76);}
 c.setTransform(canvas.width/1000,0,0,canvas.height/760,0,0);c.clearRect(0,0,1000,760);c.imageSmoothingQuality='high';
 const night=animator.night;
 if(s.flow==='discovery'){const point=ENTRANCES[s.case.source];c.translate(500,380);c.scale(1.14,1.14);c.translate(-Math.max(445,Math.min(555,point.x)),-380);}
 ground(c,night,t,animator.dusk);garden(c,s,t,night);
 if(s.waterUntil>s.time)drawSprinkler(t);
 if(s.clues.has('tracks')||s.clues.has('prints'))for(let i=0;i<12;i++)ellipse(260+i*30,415+Math.sin(i)*5,3,2,'#496967');
 const queue=Object.keys(BUILDINGS).map(id=>({depth:BUILDINGS[id].depth,draw:()=>structure(c,id,night,t,id==='home'?(sceneState(s).collapsed?'home-collapsed':sceneState(s).burned?'home-burned':'home'):id)}));
 for(const tree of TREES)queue.push({depth:tree.y,draw:()=>plant(c,tree.x,tree.y,tree.s,t,tree.kind,night)});
 queue.push({depth:360,draw:()=>drawBell(animator.bellAge,t)});
 if(!sceneState(s).body&&!sceneState(s).memorial)queue.push({depth:574,draw:()=>gardenSign(c,s)});
 for(const [x,y]of [[342,374],[668,622]])queue.push({depth:y,draw:()=>lantern(c,x,y,night,t)});
 const focused=s.lens.active?[...s.residents].filter(r=>r.watched).sort((a,b)=>dist(a,s.lens)-dist(b,s.lens))[0]?.id:null;
 const scale=width<500?1.7:1.4,labelScale=Math.max(1,800/width);
 for(const r of s.flow==='night'&&s.nightElapsed<9?[]:s.residents){const a=animator.rigs.get(r.id),selected=s.selection?.id===r.id,showLabel=selected||s.hover?.id===r.id||focused===r.id;
  queue.push({depth:a.y,draw:()=>{
   if(selected){c.beginPath();c.ellipse(a.x,a.y+10,35,13,0,0,Math.PI*2);c.fillStyle='#e6b85c38';c.fill();c.strokeStyle='#ecc66e';c.lineWidth=2;c.stroke();}
   drawCharacter(c,{...r,watched:s.flow==='discovery'||r.watched,caught:s.reconstructing&&s.reconTime>12&&r.id===s.case.culprit},a,t,scale,false);
   if(showLabel){c.save();c.translate(a.x,a.y+24);c.scale(labelScale,labelScale);rect(-29,0,58,22,'#1f4d49ed',7);text(r.name,0,11,13,'#fff0d1',700);c.restore();}
  }});
 }
 queue.push(...crimeSceneQueue(c,s,t));
 drawParticles(false);queue.sort((a,b)=>a.depth-b.depth).forEach(item=>item.draw());drawParticles(true);foreground(c,night);
 if(s.selection?.type==='support'){
  const target=interactionTargets(s,width).find(t=>t.type==='support'&&t.id===s.selection.id),person=SUPPORTING.find(r=>r.id===s.selection.id);
  if(target&&person){const b=target.rect,x=b.x+b.w/2,y=b.y+b.h;ellipse(x,y,35,11,'#e6b85c38','#ecc66e');c.save();c.translate(x,y+15);c.scale(labelScale,labelScale);rect(-29,0,58,22,'#1f4d49ed',7);text(person.name,0,11,13,'#fff0d1',700);c.restore();}
 }
 for(const l of LOCATIONS){
  const selected=s.selection?.id===l.id,hover=s.hover?.id===l.id,near=s.lens.active&&dist(s.lens,l.door)<s.lens.radius+40;
  const unexplored=s.flow!=='night'&&s.crimeDone&&!s.solved&&s.case.clues.some(cl=>cl.location===l.id&&cl.kind!=='intervention'&&!s.clues.has(cl.id));
  if(s.flow==='observe'){const size=Math.max(12,9000/width);ellipse(l.door.x,l.door.y,size,size,'#f6e8c8de','#7c7255');text(l.id===s.case.preLocation?'▤':'↳',l.door.x,l.door.y+1,size,'#365b4c',700);}
  if(unexplored){const cluePoint=evidencePoint(s,l.id),x=cluePoint.x+23,y=cluePoint.y+4;ctx.save();ctx.translate(x,y);ctx.scale(labelScale,labelScale);ctx.rotate(t*.25);path([[-6,0],[-1,-2],[0,-8],[2,-2],[7,0],[2,2],[0,7],[-2,2]],'#ffe7a0',null);ctx.restore();if(near||selected){ellipse(x,y,12*labelScale,12*labelScale,'#e7bd5835');}}
  if(selected||hover){const x=l.door.x,y=l.door.y+35;c.save();c.translate(Math.max(68*labelScale,Math.min(1000-68*labelScale,x)),y);c.scale(labelScale,labelScale);rect(-66,-11,132,23,'#1c4846ec',7);text(l.name,0,1,12,'#f5dfb3',700);c.restore();}
 }
 if(s.guideTarget&&s.flow!=='night'){
  const target=s.guideTarget;const p=target.type==='resident'?animator.rigs.get(target.id):evidencePoint(s,target.id);
  if(p){const pulse=1+Math.sin(t*3)*.07;c.beginPath();c.ellipse(p.x,p.y+8,54*pulse,18*pulse,0,0,Math.PI*2);c.strokeStyle='#ffeab1';c.lineWidth=4;c.stroke();c.beginPath();c.ellipse(p.x,p.y+8,59*pulse,21*pulse,0,0,Math.PI*2);c.strokeStyle='#946829';c.lineWidth=1.5;c.stroke();const y=p.y-(target.type==='resident'?147:69);path([[p.x-9,y-12],[p.x+9,y-12],[p.x,y]],'#f8d77b','#664e2e',1.5);}
 }
 if(s.lens.active&&!s.reconstructing){
  const {x,y,radius}=s.lens;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.strokeStyle='#174b4b80';c.lineWidth=6;c.stroke();c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.strokeStyle='#f5d590';c.lineWidth=2;c.stroke();
  for(let i=0;i<4;i++){const angle=i*Math.PI/2;c.beginPath();c.arc(x,y,radius+4,angle-.09,angle+.09);c.strokeStyle='#e0b05c';c.lineWidth=5;c.stroke();}
  path([[x+radius*.72,y+radius*.72],[x+radius*.93,y+radius*.93]],null,'#315b55',9);path([[x+radius*.72,y+radius*.72],[x+radius*.93,y+radius*.93]],null,'#d7a253',4);
  rect(x-42,y-radius-24,84,19,'#224d49ed',6);text('תחת השגחה',x,y-radius-14,10,'#f2d797',700);
 }
 if(s.reconstructing){rect(347,18,306,38,'#173f3eea',17);text('כך זה באמת קרה',500,38,20,'#f4deaf',700);}
 renderTotal+=performance.now()-began;if(++renderFrames===60){canvas.dataset.renderMs=(renderTotal/renderFrames).toFixed(2);renderFrames=0;renderTotal=0;}
}
function drawSprinkler(t){
 ellipse(285,560,68,22,'#86b5ba35');
 for(let i=0;i<6;i++){const wave=(t*1.8+i/6)%1;ctx.beginPath();ctx.ellipse(285,560,15+wave*52,5+wave*17,0,0,Math.PI*2);ctx.strokeStyle=`rgba(223,246,242,${(1-wave)*.28})`;ctx.lineWidth=1.5;ctx.stroke();}
 rect(280,546,10,15,'#587c70',3,ink);
 const sweep=Math.sin(t*2.2)*.65;
 for(let i=0;i<12;i++){
  const angle=i*Math.PI*2/12+sweep,reach=55+Math.sin(i*7)*17;
  const endX=285+Math.cos(angle)*reach,endY=560+Math.sin(angle)*reach*.36;
  ctx.beginPath();ctx.moveTo(285,547);ctx.quadraticCurveTo((285+endX)/2,493,endX,endY);ctx.strokeStyle='#d9f4f448';ctx.lineWidth=1.3;ctx.stroke();
  for(let j=0;j<3;j++){const u=(t*1.6+i*.117+j/3)%1,v=1-u;const x=v*v*285+2*v*u*(285+endX)/2+u*u*endX,y=v*v*547+2*v*u*493+u*u*endY;ellipse(x,y,1.5,2.5,'#eefdf6bf');}
  const splash=(t*2+i*.12)%1;ctx.beginPath();ctx.ellipse(endX,endY,2+splash*7,1+splash*2,0,0,Math.PI*2);ctx.strokeStyle=`rgba(226,249,242,${(1-splash)*.65})`;ctx.lineWidth=1;ctx.stroke();
 }
}
function drawBell(age,t){
 const x=489,y=349,ring=Math.exp(-age*1.1);
 ellipse(x,y+17,17,5,'#52684720');path([[x-15,y+13],[x-15,y-36],[x+15,y-36],[x+15,y+13]],null,'#827c59',3);
 ctx.save();ctx.translate(x,y-32);ctx.rotate(Math.sin(age*19)*ring*.7);
 path([[-3,3],[-9,10],[-10,23],[10,23],[9,10],[3,3]],'#d4b563');ellipse(0,24,12,4,'#edcf83',ink);ellipse(Math.sin(age*19-.8)*ring*4,29,3,4,'#8a774a');ctx.restore();
 if(age<3.5)for(let i=0;i<3;i++){const u=(age*.8+i/3)%1;ctx.beginPath();ctx.ellipse(x,y+4,20+u*80,10+u*35,0,0,Math.PI*2);ctx.strokeStyle=`rgba(255,246,195,${(1-u)*ring*.8})`;ctx.lineWidth=2;ctx.stroke();}
}
function drawParticles(front){
 for(const p of animator.particles){if((p.kind==='surprise')!==front)continue;const u=p.age/p.life;ctx.save();ctx.globalAlpha=(1-u)*.6;
  if(p.kind==='surprise'){path([[p.x,p.y+5],[p.x+p.vx*.1,p.y-2]],null,'#fff4be',3);}
  else if(p.kind==='splash'){ctx.beginPath();ctx.ellipse(p.x,p.y,2+u*12,1+u*4,0,0,Math.PI*2);ctx.strokeStyle='#eefdf6';ctx.lineWidth=2;ctx.stroke();}
  else ellipse(p.x,p.y,p.size*(.5+u),p.size*(.25+u*.3),'#b5a783',null);
  ctx.restore();
 }
}
export function interactionTargets(s,viewWidth=1000){
 const minimum=44*1000/Math.max(240,viewWidth),pad=rect=>{const w=Math.max(minimum,rect.w),h=Math.max(minimum,rect.h);return {x:rect.x-(w-rect.w)/2,y:rect.y-(h-rect.h)/2,w,h};};
 const result=s.residents.map(r=>{const a=(animator.state===s&&animator.rigs.get(r.id))||{x:r.x,y:r.y,facing:1,walk:0,watch:0,gait:0,seed:0};return {type:'resident',id:r.id,rect:pad(characterBounds(r,a,animator.clock,viewWidth<500?1.7:1.4)),depth:r.y};});
 if(s.case?.id==='fire'||s.case?.id==='courtyard'&&!s.crimeDone)result.push({type:'support',id:'badger',rect:pad({x:150,y:418,w:78,h:133})});
 if(s.case?.id==='balcony')result.push({type:'support',id:'hedgehog',rect:pad(s.crimeDone?{x:795,y:344,w:139,h:75}:{x:853,y:101,w:31,h:47})});
 for(const l of LOCATIONS){const point=s.crimeDone?evidencePoint(s,l.id):l.door;result.push({type:'location',id:l.id,rect:pad({x:point.x-28,y:point.y-26,w:56,h:54})});}
 return result;
}
export function hitCandidates(s,p,viewWidth=1000){return interactionTargets(s,viewWidth).filter(t=>p.x>=t.rect.x&&p.x<=t.rect.x+t.rect.w&&p.y>=t.rect.y&&p.y<=t.rect.y+t.rect.h&&(t.type!=='resident'||!Object.entries(BUILDINGS).some(([id,b])=>b.depth>t.depth&&artHit(id,p)))).map(({type,id})=>({type,id}));}
export function hitTest(s,p,viewWidth=1000){return hitCandidates(s,p,viewWidth)[0]||null;}
