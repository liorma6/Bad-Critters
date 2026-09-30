// Visible art bounds, ground footprints and interaction anchors share one coordinate system.
export const BUILDINGS={
 bakery:{x:39,y:28,w:297,h:297,depth:308,footprint:{x:73,y:218,w:244,h:87},sign:{x:173,y:104,size:23}},
 center:{x:353,y:39,w:284,h:284,depth:306,footprint:{x:380,y:230,w:238,h:74},sign:{x:476,y:126,size:17}},
 home:{x:727,y:0,w:220,h:330,depth:310,footprint:{x:740,y:217,w:192,h:91},sign:{x:874,y:228,size:9}},
 delivery:{x:368,y:467,w:302,h:201.333,depth:651,footprint:{x:403,y:551,w:239,h:99},sign:{x:513,y:542,size:14}},
 shed:{x:700,y:489,w:278,h:185.333,depth:657,footprint:{x:727,y:550,w:223,h:106},sign:{x:831,y:542,size:12}}
};
export const ENTRANCES={bakery:{x:239,y:337},center:{x:508,y:336},home:{x:830,y:341},garden:{x:244,y:549},delivery:{x:511,y:676},shed:{x:804,y:684}};
export const FOOTPRINTS=Object.values(BUILDINGS).map(b=>b.footprint);
export function contains(rect,p,pad=0){return p.x>=rect.x-pad&&p.x<=rect.x+rect.w+pad&&p.y>=rect.y-pad&&p.y<=rect.y+rect.h+pad;}
export function artHit(id,p){const b=BUILDINGS[id];return b?contains(b,p):p.x>=39&&p.x<=330&&p.y>=461&&p.y<=662;}

// Bounded visibility graph: five footprints, twenty corners. Routes stay in open space.
const clearance=12;
const obstacles=FOOTPRINTS.map(r=>({x:r.x-clearance,y:r.y-clearance,w:r.w+clearance*2,h:r.h+clearance*2}));
const corners=obstacles.flatMap(r=>[{x:r.x-8,y:r.y-8},{x:r.x+r.w+8,y:r.y-8},{x:r.x+r.w+8,y:r.y+r.h+8},{x:r.x-8,y:r.y+r.h+8}]);
function intersects(a,b,r){
 let lo=0,hi=1;
 for(const [p,d,min,max]of [[a.x,b.x-a.x,r.x,r.x+r.w],[a.y,b.y-a.y,r.y,r.y+r.h]]){
  if(Math.abs(d)<1e-9){if(p<=min||p>=max)return false;continue;}
  const t1=(min-p)/d,t2=(max-p)/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>=hi)return false;
 }
 return hi>0&&lo<1;
}
export const routeSegmentClear=(a,b)=>!obstacles.some(r=>intersects(a,b,r));
export function findRoute(start,end){
 const a={x:start.x,y:start.y},b={x:end.x,y:end.y};if(routeSegmentClear(a,b))return [b];
 const nodes=[a,b,...corners],cost=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),visited=new Set();cost[0]=0;
 for(let count=0;count<nodes.length;count++){
  let u=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(u<0||cost[i]<cost[u]))u=i;
  if(u<0||!Number.isFinite(cost[u]))break;if(u===1)break;visited.add(u);
  for(let v=1;v<nodes.length;v++)if(!visited.has(v)&&routeSegmentClear(nodes[u],nodes[v])){const c=cost[u]+Math.hypot(nodes[v].x-nodes[u].x,nodes[v].y-nodes[u].y);if(c<cost[v]){cost[v]=c;prev[v]=u;}}
 }
 if(prev[1]===-1)return []; // Unreachable targets fail closed; tests cover every authored entrance.
 const result=[];for(let v=1;v!==0;v=prev[v])result.unshift(nodes[v]);return result;
}
