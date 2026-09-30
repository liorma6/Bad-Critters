// Presentation-only animation: no clocks, evidence, routes or other simulation state are mutated.
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));
export const GAITS={
 pigeon:{stride:32,lift:5,bounce:3.8,sway:.085},
 boar:{stride:43,lift:5,bounce:2.7,sway:.06},
 cat:{stride:46,lift:7,bounce:1.8,sway:.035},
 turtle:{stride:30,lift:3,bounce:1.2,sway:.045},
 goat:{stride:24,lift:1,bounce:.2,sway:.02},
 snake:{stride:65,lift:0,bounce:0,sway:.035}
};
export class Animator {
 constructor(){this.state=null;this.clock=0;this.rigs=new Map();this.particles=[];this.night=0;this.dusk=0;this.bellAge=100;this.waterAge=100;this.previousBell=2;this.previousWater=2;}
 reset(s){this.state=s;this.clock=0;this.rigs.clear();this.particles=[];this.night=0;this.dusk=0;this.bellAge=100;this.waterAge=100;this.previousBell=s.bell;this.previousWater=s.sprinkler;for(const [i,r]of s.residents.entries())this.rigs.set(r.id,{x:r.x,y:r.y,previousX:r.x,previousY:r.y,gait:i*1.37,step:0,speed:0,walk:0,facing:1,direction:1,vertical:0,watch:0,wasWatched:false,startle:0,arrival:0,carryPop:0,previousCarry:r.carry,blink:0,seed:i*1.71,wet:0});}
 emit(p){if(this.particles.length<100)this.particles.push({...p,age:0});}
 update(s,dt,playing=true){
  if(this.state!==s)this.reset(s);
  if(!playing)return this;
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(!dt)return this;
  this.clock+=dt;this.bellAge+=dt;this.waterAge+=dt;
  this.night=ease(this.night,s.phase==='night'||s.phase==='investigate'?1:0,1.5,dt);
  this.dusk=ease(this.dusk,s.phase==='dusk'?1:0,1.2,dt);
  if(s.bell<this.previousBell){this.bellAge=0;this.previousBell=s.bell;}
  if(s.sprinkler<this.previousWater){this.waterAge=0;this.previousWater=s.sprinkler;}
  for(const r of s.residents){
   const a=this.rigs.get(r.id),g=GAITS[r.id];
   let dx=r.x-a.previousX,dy=r.y-a.previousY,d=Math.hypot(dx,dy);
   a.previousX=r.x;a.previousY=r.y;
   // Case starts, gate arrival and reconstruction resets are teleports, never long animated slides.
   if(d>90){a.x=r.x;a.y=r.y;dx=dy=d=0;a.walk=0;}
   a.x=ease(a.x,r.x,25,dt);a.y=ease(a.y,r.y,25,dt);
   a.speed=ease(a.speed,d/dt,12,dt);
   const moving=d>.02;a.walk=ease(a.walk,moving?1:0,moving?10:15,dt);
   a.gait+=d/g.stride*TAU;
   if(Math.abs(dx)>.04)a.direction=Math.sign(dx);
   a.facing=ease(a.facing,a.direction,15,dt);
   a.vertical=ease(a.vertical,dy?Math.sign(dy):0,7,dt);
   a.watch=ease(a.watch,r.watched?1:0,9,dt);
   a.wet=ease(a.wet,s.waterUntil>s.time&&r.x<390&&r.y>390?1:0,7,dt);
   if(r.watched&&!a.wasWatched){a.startle=1;for(let j=0;j<3;j++)this.emit({kind:'surprise',x:r.x+(j-1)*15,y:r.y-70,vx:(j-1)*9,vy:-25,life:.55,size:3});}
   a.wasWatched=r.watched;a.startle=Math.max(0,a.startle-dt*2.5);
   if(a.previousCarry!==r.carry){a.carryPop=1;a.previousCarry=r.carry;}
   a.carryPop=Math.max(0,a.carryPop-dt*3);
   if(!moving&&a.walk>.6)a.arrival=1;
   a.arrival=Math.max(0,a.arrival-dt*4);
   const blinkPhase=(this.clock+a.seed)%4.7;
   a.blink=blinkPhase>4.45?Math.sin((blinkPhase-4.45)/.25*Math.PI):0;
   const step=Math.floor(a.gait/Math.PI);
   if(step!==a.step&&moving&&a.walk>.45){a.step=step;const foot=step%2?8:-8;this.emit({kind:a.wet>.4?'splash':'dust',x:a.x+foot,y:a.y+8,vx:-dx/dt*.05,vy:-8,life:.55,size:r.id==='boar'?7:4});}
  }
  for(const p of this.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
  this.particles=this.particles.filter(p=>p.age<p.life);
  return this;
 }
}
