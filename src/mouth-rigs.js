// Code-native textured jaw rigs, registered to each painted mouth. Opening
// splits the actual lip curve and moves the original lower-jaw pixels. No flat
// skin patch and no second mouth are drawn over the baked artwork.
// Speech uses the idle body pose, so the registration never drifts between poses.
export const MOUTH_RIGS={
 goat:{mask:[[386,118],[423,118],[426,139],[385,140]],lip:[[391,125],[408,122],[420,128]],skin:['#d2bf91','#8e795e'],depth:11},
 pigeon:{mask:[[363,84],[393,84],[408,105],[407,121],[387,108],[363,96]],lip:[[368,89],[391,91],[402,112]],skin:['#857c71','#433e39'],depth:10,beak:true},
 snake:{mask:[[350,111],[417,114],[416,128],[349,125]],lip:[[355,116],[389,123],[413,119]],skin:['#c9b67d','#958553'],depth:12},
 cat:{mask:[[300,84],[329,82],[333,99],[297,101]],lip:[[303,92],[317,83],[328,88]],skin:['#dfd0ac','#a69474'],depth:10},
 boar:{mask:[[337,133],[351,131],[355,144],[372,142],[388,155],[377,169],[337,157]],lip:[[337,133],[353,132],[379,148]],skin:['#a88b68','#715641'],depth:12},
 turtle:{mask:[[422,315],[480,315],[482,342],[420,339]],lip:[[428,314],[452,305],[476,322]],skin:['#b6a273','#81734e'],depth:12,beak:true},
 badger:{mask:[[683,328],[766,331],[764,359],[681,357]],lip:[[689,338],[725,335],[761,340]],skin:['#d4c49e','#ac9a76'],depth:18},
 hedgehog:{mask:[[631,355],[719,357],[716,387],[628,385]],lip:[[638,367],[675,358],[711,370]],skin:['#d6ba8c','#b59d76'],depth:19}
};
export function drawSpeakingSprite(c,image,frame,k,rig,state){
 const [sx,sy,sw,sh,anchor]=frame;c.save();c.translate(-anchor*k,8-sh*k);c.scale(k,k);c.translate(-sx,-sy);
 if(!state){c.drawImage(image,sx,sy,sw,sh,sx,sy,sw,sh);c.restore();return;}
 const [a,b,d]=rig.lip,opening=rig.depth*[0,.3,.65,1][state],jawHeight=rig.depth*2.5;
 const points=[],steps=Math.ceil((d[0]-a[0])*2);
 for(let i=0;i<=steps;i++){const t=i/steps,u=1-t;points.push({x:u*u*a[0]+2*u*t*b[0]+t*t*d[0],y:u*u*a[1]+2*u*t*b[1]+t*t*d[1],drop:Math.sin(Math.PI*t)*opening});}
 // Remove the original lower-lip region before redrawing the same texture.
 c.save();c.beginPath();c.rect(sx,sy,sw,sh);c.moveTo(...a);c.quadraticCurveTo(...b,...d);c.lineTo(d[0],d[1]+jawHeight);c.quadraticCurveTo(b[0],b[1]+jawHeight,a[0],a[1]+jawHeight);c.closePath();c.clip('evenodd');c.drawImage(image,sx,sy,sw,sh,sx,sy,sw,sh);c.restore();
 c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));for(const p of [...points].reverse())c.lineTo(p.x,p.y+p.drop+.5);c.closePath();c.fillStyle='#30241e';c.fill();
 // Narrow strips form a continuous mesh: corners and the bottom edge stay fixed.
 for(let i=0;i<points.length-1;i++){const p=points[i],width=points[i+1].x-p.x+.2;c.drawImage(image,p.x,p.y,width,jawHeight,p.x,p.y+p.drop,width,jawHeight-p.drop);}
 c.restore();
}
