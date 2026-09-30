import {artAssets} from './art-assets.js';
import {DARK_FRAMES} from './dark-frames.js';
import {speech} from './speech-animation.js';
import {MOUTH_RIGS,drawSpeakingSprite} from './mouth-rigs.js';
export const CHARACTER_HEIGHT={pigeon:102,cat:108,boar:109,turtle:67,goat:114,snake:73};
export function characterPose(r,a,t){
 if(r.caught)return 5;
 if(r.watched||a.watch>.55)return 3;
 if(r.carry)return 4;
 if(a.walk>.25){const phase=Math.floor((((a.gait%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI/2));return (r.id==='pigeon'?[2,1,1,2]:r.id==='snake'?[1,1,2,2]:[0,1,0,2])[phase];}
 if(r.id==='snake'&&r.x<205&&r.y>530)return 4;
 if(r.id==='cat'&&Math.hypot(r.x-616,r.y-401)<24)return 4;
 const clock=(t+a.seed)%9;
 if(r.id==='boar')return clock>6.5?3:clock>4?4:0;
 if(r.id==='turtle')return clock>8.1?3:clock>6.2?4:0;
 if(r.id==='goat')return r.action==='check-list'&&clock>5.8?4:0;
 return clock>7.2?4:0;
}
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
export function characterBounds(r,a,t,scale){const frames=DARK_FRAMES[r.id];if(!frames)return {x:r.x-43,y:r.y-100,w:86,h:122};const frame=frames[characterPose(r,a,t)],k=CHARACTER_HEIGHT[r.id]/frames[0][3]*scale,w=frame[2]*k,left=Math.sign(a.facing||1)>0?-frame[4]*k:(frame[4]-frame[2])*k;return {x:a.x+left,y:a.y+(8-frame[3]*CHARACTER_HEIGHT[r.id]/frames[0][3])*scale-12,w,h:frame[3]*k+34};}
function documentProp(c,r){
 if(!r.carry)return;
 const red=r.carry==='notebook';c.save();c.translate(r.id==='pigeon'?21:25,-40);c.rotate(-.2);c.fillStyle=red?'#963d35':'#d0b88e';c.fillRect(-10,-8,21,27);c.strokeStyle=red?'#613c32':'#766a55';c.lineWidth=2;c.strokeRect(-10,-8,21,27);c.fillStyle='#e8d7b0';c.fillRect(-7,-5,3,20);c.restore();
}
// Existing bent pose now reads a complaint list. This prop never marks the ground
// and is presentation-only: it cannot add evidence or change a witness route.
function complaintList(c,t){
 c.save();c.translate(1,-30);c.rotate(-.12+Math.sin(t*2)*.025);
 c.fillStyle='#5d4632';c.fillRect(-8,-9,16,21);c.fillStyle='#e4d2ac';c.fillRect(-6,-7,12,16);
 c.strokeStyle='#655744';c.lineWidth=.8;
 for(let i=0;i<4;i++){c.beginPath();c.moveTo(-3,-4+i*3.1);c.lineTo(4,-4+i*3.1);c.stroke();}
 c.strokeStyle='#963d35';c.lineWidth=1.1;
 for(let i=0;i<2+(Math.floor(t)%2);i++){c.beginPath();c.moveTo(-5,-4+i*3.1);c.lineTo(-4,-3+i*3.1);c.lineTo(-2.5,-5+i*3.1);c.stroke();}
 c.restore();
}
export function drawCharacter(c,r,a,t,scale=1,labels=true){
 const image=artAssets[`${r.id}-dark`],frames=DARK_FRAMES[r.id];if(!image||!frames)return;
 const speaking=speech.resident===r.id,pose=speaking?0:characterPose(r,a,t),[sx,sy,sw,sh,anchor]=frames[pose],k=CHARACTER_HEIGHT[r.id]/frames[0][3];
 const direction=Math.sign(a.facing||1),moving=a.walk>.25;
 const flight=r.id==='pigeon'&&moving?Math.max(0,Math.sin(a.gait)) * 11:0;
 const slither=r.id==='snake'&&moving?Math.sin(a.gait)*.018:0;
 // Feet and coils stay grounded. Only the bird leaves its ground shadow.
 c.save();c.translate(a.x,a.y);c.scale(scale,scale);
 const shadow=c.createRadialGradient(0,8,1,0,8,r.id==='snake'?43:31);shadow.addColorStop(0,'#203e3a50');shadow.addColorStop(1,'#203e3a00');oval(c,0,8,r.id==='boar'?36:r.id==='snake'?43:30,9-flight*.15,shadow);
 c.save();c.scale(direction,1);c.translate(0,-flight);c.rotate(slither);
 const breath=r.id==='boar'?Math.sin(t*2.8+a.seed)*.005:Math.sin(t*1.6+a.seed)*.002;
 c.translate(0,8);c.scale(1-breath,1+breath);c.translate(0,-8);
 if(speaking)drawSpeakingSprite(c,image,frames[0],k,MOUTH_RIGS[r.id],speech.mouth);
 else c.drawImage(image,sx,sy,sw,sh,-anchor*k,8-sh*k,sw*k,sh*k);documentProp(c,r);
 if(r.id==='goat'&&r.action==='check-list'&&pose===4&&!speaking)complaintList(c,t);c.restore();
 if(labels){c.fillStyle='#f3e5cbed';c.beginPath();c.roundRect(-36,20,72,22,5);c.fill();c.font='700 14px Arial';c.direction='rtl';c.textAlign='center';c.fillStyle='#294e45';c.fillText(r.name,0,36);}c.restore();
}
