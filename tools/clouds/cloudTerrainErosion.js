// CPU adaptation of phacelleNoise / erosionFilter in tools/noise/noiseCompute.wgsl.
// Slope-directed, overlapping noise carriers make connected gullies. Evaluated
// only when building the terrain mesh; this is erosion-shaped noise, not a fluid simulation.
const clamp=v=>Math.max(0,Math.min(1,v));
const fract=v=>v-Math.floor(v);
const easeOut=v=>1-(1-clamp(v))**2;
const smoothStart=(v,s)=>v>=s?v-s*.5:v*v/(2*s);
function carrier(x,z,dx,dz){
 const tau=Math.PI*2,sideX=-dz*.9*tau,sideZ=dx*.9*tau;
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 let real=0,imag=0,weights=0;
 for(let j=-1;j<=2;j++)for(let i=-1;i<=2;i++){
  const qx=(ix+i)*.3183099+.3678794,qz=(iz+j)*.3678794+.3183099;
  const h=fract(qx*qz*(qx+qz));
  const vx=fx-i-(fract(16*.3183099*h)-.5);
  const vz=fz-j-(fract(16*.3678794*h)-.5);
  const w=Math.max(0,Math.exp(-2*(vx*vx+vz*vz))-.01111);
  const phase=vx*sideX+vz*sideZ+tau*.25;
  real+=Math.cos(phase)*w;imag+=Math.sin(phase)*w;weights+=w;
 }
 const norm=Math.max(weights*.55,Math.hypot(real,imag),1e-6);
 return [real/norm,imag/norm,sideX,sideZ];
}
export function terrainErosion(x,z,slopeX,slopeZ,pixelSpan){
 const slope=Math.hypot(slopeX,slopeZ);
 if(slope<1e-6)return 0;
 let gx=slopeX/slope*.7,gz=slopeZ/slope*.7;
 let frequency=1/(12*.9),strength=12*.35,mask=easeOut(smoothStart(slope*1.25,.01));
 let fade=-.65,delta=0,rounding=1;
 for(let octave=0;octave<3;octave++){
  // Match the erosion example's footprint filter: no sub-triangle stripes.
  const step=frequency*.9*Math.PI*2*pixelSpan;
  const t=clamp((step-1.05)/(2.4-1.05)),visible=1-t*t*(3-2*t);
  if(visible<1e-4)break;
  const length=Math.max(Math.hypot(gx,gz),1e-10);
  const [a,b,sx,sz]=carrier((x+37.1)*frequency,(z-19.7)*frequency,gx/length,gz/length);
  const phase=Math.sign(a)*Math.abs(a)**1.75,weight=strength*visible;
  gx+=Math.sign(b)*-sx*frequency*weight*.5*1.1;
  gz+=Math.sign(b)*-sz*frequency*weight*.5*1.1;
  delta+=((fade*(1-mask)+phase*.75*mask)-.45)*weight;
  fade=fade*(1-visible)+(fade*(1-mask)+phase*mask)*visible;
  const round=(phase*.5+.5)*.1*rounding;
  const next=easeOut(smoothStart(Math.abs(b)*1.25,Math.max(round*1.25,1e-6)));
  mask=(1-(1-clamp(mask))**1.35)*(1-visible+next*visible);
  strength*=.55;frequency*=2.25;rounding*=2.25;
 }
 return delta;
}
