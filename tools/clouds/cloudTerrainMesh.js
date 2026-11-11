// Reusable rasterized heightfield; all geometry is generated once on the CPU.
import {terrainErosion} from './cloudTerrainErosion.js';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
function lattice(x,z){
 let h=Math.imul(x,374761393)^Math.imul(z,668265263)^0x5bd1e995;
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const a=lattice(ix,iz),b=lattice(ix+1,iz),c=lattice(ix,iz+1),d=lattice(ix+1,iz+1);
 return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function baseTerrainHeight(x,z){
 const r=Math.hypot(x,z*.86),q=r+5*Math.sin(x*.055)+4*Math.sin(z*.061);
 const rim=smooth(22,49,q)*(1-smooth(68,112,q));
 if(rim===0)return -6;
 const wx=x+9*(noise(x*.023+17,z*.023)-.5),wz=z+9*(noise(x*.023,z*.023+31)-.5);
 const ridge=(f,ox,oz)=>1-Math.sqrt((noise(wx*f+ox,wz*f+oz)*2-1)**2+.025);
 const mountain=Math.max(0,ridge(.037,9,23));
 const folds=Math.max(0,ridge(.105,41,7));
 const scree=noise(wx*.28+71,wz*.28+53)-.5;
 return -6+rim*(7+24*mountain**2.8+5.5*folds**3+scree*1.2);
}
export function terrainHeight(x,z,erosionStrength=1,pixelSpan=1.2){
 const base=baseTerrainHeight(x,z);
 if(base===-6 || erosionStrength===0)return base;
 // A fixed world-space guide keeps the gully direction independent of mesh LOD.
 const d=.8,sx=(baseTerrainHeight(x+d,z)-baseTerrainHeight(x-d,z))/(2*d);
 const sz=(baseTerrainHeight(x,z+d)-baseTerrainHeight(x,z-d))/(2*d);
 const mask=smooth(-5,-.5,base);
 return Math.max(-6,base+terrainErosion(x,z,sx,sz,pixelSpan)*mask*erosionStrength);
}
export function createTerrainMesh(resolution=289,extent=192){
 const vertices=new Float32Array((resolution*resolution+8)*6),indices=new Uint32Array((resolution-1)**2*6+24);
 // Concentrate triangles around the basin and ridges, not the flat outer apron.
 const axis=Float64Array.from({length:resolution},(_,i)=>{
  const u=i*2/(resolution-1)-1;return extent*u*(.3+.7*Math.abs(u));
 });
 const heights=new Float64Array(resolution*resolution);
 for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){
  const span=Math.max(axis[Math.min(x+1,resolution-1)]-axis[Math.max(x-1,0)],axis[Math.min(z+1,resolution-1)]-axis[Math.max(z-1,0)])*.5;
  heights[z*resolution+x]=terrainHeight(axis[x],axis[z],1,span);
 }
 for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){
  const x0=Math.max(0,x-1),x1=Math.min(resolution-1,x+1),z0=Math.max(0,z-1),z1=Math.min(resolution-1,z+1);
  const nx=(heights[z*resolution+x0]-heights[z*resolution+x1])/(axis[x1]-axis[x0]);
  const nz=(heights[z0*resolution+x]-heights[z1*resolution+x])/(axis[z1]-axis[z0]);
  const length=Math.hypot(nx,1,nz),offset=(z*resolution+x)*6;
  vertices.set([axis[x],heights[z*resolution+x],axis[z],nx/length,1/length,nz/length],offset);
 }
 let i=0;
 for(let z=0;z<resolution-1;z++)for(let x=0;x<resolution-1;x++){
  const a=z*resolution+x,b=a+1,c=a+resolution,d=c+1;indices.set([a,c,b,b,c,d],i);i+=6;
 }
 const base=resolution*resolution,outer=16384,corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
 for(let ring=0;ring<2;ring++)for(let c=0;c<4;c++){
  const radius=ring?outer:extent,[x,z]=corners[c];vertices.set([x*radius,-6,z*radius,0,1,0],(base+ring*4+c)*6);
 }
 for(let c=0;c<4;c++){
  const a=base+c,b=base+(c+1)%4,d=a+4,e=b+4;indices.set([a,b,d,b,e,d],i);i+=6;
 }
 return {vertices,indices};
}
