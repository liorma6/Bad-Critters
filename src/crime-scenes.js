import {artAssets} from './art-assets.js';
import {sceneState} from './incidents.js';
import {drawSupporting} from './supporting-sprites.js';
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c,points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function label(c,text,x,y){c.font='bold 13px Arial';c.textAlign='center';c.direction='rtl';c.fillStyle='#f6e7c5';c.fillText(text,x,y);}
function tape(c,x,y,w){for(const dx of [0,w]){line(c,[[x+dx,y],[x+dx,y-26]],'#4f5950',4);oval(c,x+dx,y,8,3,'#293c3444');}line(c,[[x,y-22],[x+w,y-19]],'#e6b85e',7);for(let a=5;a<w;a+=19)line(c,[[x+a,y-25],[x+a+6,y-18]],'#554731',4);}
function suitcase(c,x,y){c.fillStyle='#75614b';c.beginPath();c.roundRect(x-16,y-18,32,22,3);c.fill();line(c,[[x-7,y-18],[x-7,y-23],[x+6,y-23],[x+6,y-18]],'#bd9b63',2);line(c,[[x-9,y-17],[x-9,y+3]],'#baa783',3);line(c,[[x+9,y-17],[x+9,y+3]],'#baa783',3);}
export function crimeSceneQueue(c,s,t){
 const v=sceneState(s),q=[];
 if(v.burned)q.push({depth:343,draw:()=>{tape(c,756,342,149);suitcase(c,925,326);c.fillStyle='#e4d1a9';c.fillRect(774,280,29,20);c.fillStyle='#844c39';c.font='bold 8px Arial';c.fillText('סגור',789,293);}});
 if(s.case.id==='fire')q.push({depth:690,draw:()=>{suitcase(c,554,679);suitcase(c,582,681);}});
 if(v.fireActive||v.smoke)q.push({depth:335,draw:()=>{
  if(v.fireActive){const g=c.createRadialGradient(815,241,5,815,241,120);g.addColorStop(0,'#ffba596a');g.addColorStop(1,'#fa541000');c.fillStyle=g;c.fillRect(695,116,240,240);
   for(const [x,y]of [[775,252],[825,282],[862,157],[777,150]])for(let i=0;i<5;i++){const h=18+9*Math.sin(t*7+i*2+x);c.beginPath();c.moveTo(x-7+i*3,y);c.quadraticCurveTo(x-12+i*3,y-h*.45,x-3+i*3+Math.sin(t*5+i)*5,y-h);c.quadraticCurveTo(x+10+i*3,y-h*.3,x+7+i*3,y);c.fillStyle=i%2?'#f8c676dd':'#c86533cf';c.fill();}}
  for(let i=0;i<9;i++){const u=(t*.15+i/9)%1;c.save();c.globalAlpha=(1-u)*(v.fireActive?.5:.2);oval(c,810+Math.sin(i*9)*30+u*30,230-u*170,12+u*26,18+u*18,'#514d44');c.restore();}
 }});
 if(v.body||v.memorial)q.push({depth:555,draw:()=>{
  if(v.body){oval(c,207,556,98,14,'#35372f33');const img=artAssets['courtyard-evidence'];if(img)c.drawImage(img,93,429,230,153);
  }else{c.fillStyle='#494840';c.fillRect(166,507,63,26);label(c,'לזכר עמוס',197,524);for(let i=0;i<6;i++){line(c,[[200,550],[187+i*5,534]],'#66804e');oval(c,187+i*5,534,3,3,'#d9b7a3');}}
  tape(c,95,589,222);
 }});
 if(v.badgerAlive)q.push({depth:552,draw:()=>drawSupporting(c,'badger',142,414,94,141)});
 if(v.hedgehog==='balcony')q.push({depth:311,draw:()=>drawSupporting(c,'hedgehog',853,101,31,47)});
 if(v.hedgehog==='injured')q.push({depth:435,draw:()=>{const img=artAssets['hedgehog-injured'];if(img)c.drawImage(img,768,332,193,97);tape(c,770,440,182);}});
 if(v.collapsed)q.push({depth:347,draw:()=>{for(let i=0;i<13;i++){const x=788+(i*47)%145,y=314+(i*23)%29;c.fillStyle=i%2?'#a68e74':'#c0a47d';c.beginPath();c.moveTo(x,y);c.lineTo(x+7,y-6);c.lineTo(x+16,y-2);c.lineTo(x+10,y+5);c.closePath();c.fill();}line(c,[[840,328],[861,312],[874,333]],'#645b46',5);}});
 if(v.collapseActive)q.push({depth:430,draw:()=>{for(let i=0;i<14;i++){const u=((s.reconstructing?s.reconTime-12:s.nightElapsed-6)/3);c.save();c.globalAlpha=Math.max(0,(1-u))*.5;oval(c,817+Math.sin(i*7)*70*u,244+u*100+Math.cos(i)*10,10+u*30,7+u*20,'#c3b29a');c.restore();}}});
 return q;
}
