'use client';
import {useEffect,useRef} from 'react';
// Photoreal Earth (decorative, aria-hidden). Day/night shader with city lights on the dark side, ocean sun-glint,
// atmosphere rim, drifting clouds and (dark theme) stars. It anchors to an empty area of the current screen and is
// clipped to it: the login story panel, the client welcome banner, or the space beside a workspace page heading.
// shortcut: NASA-derived maps load from jsDelivr pinned to three r170; self-host them in /public if the CDN must be avoided.
const TEX='https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/';
type Spot={cx:number,cy:number,r:number,clip?:DOMRect,space?:boolean};
function anchor():Spot|null{
 const vis=(r:DOMRect)=>r.width>0&&r.bottom>0&&r.top<innerHeight;
 const story=document.querySelector('.login-story');
 if(story){const r=story.getBoundingClientRect();if(vis(r))return{cx:r.left+r.width*.62,cy:r.bottom+r.width*.3,r:r.width*.62,clip:r,space:true};}
 // Workspace + client portal: a large globe in the right corner, half hidden past the edge, half visible.
 if(document.querySelector('.shell,.client-shell')){const r=Math.min(innerWidth*.34,innerHeight*.52,520);return{cx:innerWidth,cy:innerHeight*(innerWidth<800?.9:.6),r};}
 return null;
}
export default function Nv3D(){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let stop=()=>{};let cancelled=false;
  (async()=>{
   const THREE=await import('three');
   const host=ref.current;if(cancelled||!host)return;
   let renderer:import('three').WebGLRenderer;
   try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{return;}
   renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
   renderer.autoClear=false;renderer.setClearColor(0x000000,0);host.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,1,.1,200);cam.position.set(0,0,10);
   const load=new THREE.TextureLoader();load.setCrossOrigin('anonymous');
   const tex=(f:string,srgb=true)=>{const t=load.load(TEX+f);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;};
   const sunWorld=new THREE.Vector3(-.55,.6,.95).normalize();
   const uni={day:{value:tex('earth_atmos_2048.jpg')},night:{value:tex('earth_lights_2048.png')},spec:{value:tex('earth_specular_2048.jpg',false)},sunDir:{value:new THREE.Vector3()}};
   const earth=new THREE.Group();earth.rotation.z=23.4*Math.PI/180;scene.add(earth);
   const globe=new THREE.Mesh(new THREE.SphereGeometry(1,160,160),new THREE.ShaderMaterial({uniforms:uni,
    vertexShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D day,night,spec;uniform vec3 sunDir;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
     void main(){vec3 n=normalize(vN);float d=dot(n,sunDir);float lit=smoothstep(-.12,.22,d);
      vec3 dayC=texture2D(day,vUv).rgb*(max(d,0.)*1.7+.05);
      vec3 nightC=texture2D(night,vUv).rgb*vec3(1.,.78,.45)*1.6*(1.-lit);
      vec3 col=dayC*lit+nightC;
      float ocean=texture2D(spec,vUv).r;vec3 h=normalize(sunDir+vV);col+=ocean*pow(max(dot(n,h),0.),80.)*vec3(1.,.95,.85)*1.1*lit;
      float rim=pow(1.-max(dot(n,vV),0.),3.);col+=vec3(.4,.68,1.)*rim*(.35+1.3*smoothstep(-.3,.5,d));
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
     }`}));
   const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.009,128,128),new THREE.MeshLambertMaterial({map:tex('earth_clouds_1024.png'),transparent:true,opacity:.9,depthWrite:false}));
   earth.add(globe,clouds);
   const atmo=new THREE.Mesh(new THREE.SphereGeometry(1.12,96,96),new THREE.ShaderMaterial({uniforms:{sunDir:uni.sunDir},transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 sunDir;varying vec3 vN;varying vec3 vV;void main(){float i=pow(clamp(.78+dot(vN,vV),0.,1.),5.);float s=.35+.65*smoothstep(-.4,.6,dot(-vN,sunDir));float a=clamp(i*s*2.2,0.,1.);gl_FragColor=vec4(vec3(.35,.62,1.)*a,a);}'}));
   scene.add(atmo);
   const ll=(lat:number,lon:number,r=1)=>{const p=(90-lat)*Math.PI/180,t=(lon+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t));};
   const cities:[number,number][]=[[13.08,80.27],[19.08,72.88],[28.61,77.21],[25.2,55.27],[51.5,-.13],[40.71,-74],[1.35,103.82],[35.68,139.69],[-33.87,151.2],[48.86,2.35]];
   const arcU={time:{value:0}};
   const arcMat=new THREE.ShaderMaterial({uniforms:arcU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute float off;varying vec2 vUv;varying float vOff;void main(){vUv=uv;vOff=off;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float time;varying vec2 vUv;varying float vOff;void main(){float h=fract(time*.22+vOff);float d=abs(vUv.x-h);float head=smoothstep(.16,0.,d)*step(vUv.x,h+.02);float base=.16*sin(vUv.x*3.1416);float a=clamp(head+base,0.,1.);gl_FragColor=vec4(mix(vec3(.55,.75,1.),vec3(1.,.86,.55),head)*a,a);}'});
   const home=ll(cities[0][0],cities[0][1]);
   cities.slice(1).forEach(([la,lo],i)=>{const b=ll(la,lo),mid=home.clone().add(b).multiplyScalar(.5),lift=1+home.distanceTo(b)*.38;mid.normalize().multiplyScalar(lift);
    const g=new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(home.clone().multiplyScalar(1.005),mid,b.clone().multiplyScalar(1.005)),64,.0045,6,false);
    g.setAttribute('off',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i/9),1));globe.add(new THREE.Mesh(g,arcMat));});
   const dotMat=new THREE.MeshBasicMaterial({color:0xffd894,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
   const dots=cities.map(([la,lo],i)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(i?.011:.018,16,16),dotMat);m.position.copy(ll(la,lo,1.006));globe.add(m);return m;});
   const moonPivot=new THREE.Group();earth.add(moonPivot);moonPivot.rotation.x=.35;
   const moon=new THREE.Mesh(new THREE.SphereGeometry(.16,64,64),new THREE.MeshStandardMaterial({map:tex('moon_1024.jpg'),roughness:1,metalness:0}));moon.position.set(2.05,0,0);moonPivot.add(moon);
   const ringPivot=new THREE.Group();ringPivot.rotation.set(1.15,.25,0);earth.add(ringPivot);
   ringPivot.add(new THREE.Mesh(new THREE.TorusGeometry(1.45,.0022,8,256),new THREE.MeshBasicMaterial({color:0xe3c27c,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false})));
   const sat=new THREE.Mesh(new THREE.SphereGeometry(.022,16,16),new THREE.MeshBasicMaterial({color:0xfff1cf}));ringPivot.add(sat);
   const sun=new THREE.DirectionalLight(0xfff2e0,3.2);scene.add(sun,new THREE.AmbientLight(0x1a2240,.25));
   const sp=new Float32Array(1800);for(let i=0;i<sp.length;i+=3){const v=new THREE.Vector3().randomDirection().multiplyScalar(60+Math.random()*30);sp[i]=v.x;sp[i+1]=v.y;sp[i+2]=v.z-60;}
   const stars=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(sp,3)),new THREE.PointsMaterial({color:0xffffff,size:.18,sizeAttenuation:true,transparent:true,opacity:.75,depthWrite:false}));scene.add(stars);
   const size=()=>{renderer.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();};size();addEventListener('resize',size);
   const halfH=Math.tan(15*Math.PI/180)*10;
   const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;let py=0,px=0,raf=0;const clock=new THREE.Clock();
   const pm=(e:PointerEvent)=>{px=e.clientX/innerWidth-.5;py=e.clientY/innerHeight-.5;};addEventListener('pointermove',pm,{passive:true});
   globe.rotation.y=-1.9;clouds.rotation.y=-1.9;
   const frame=()=>{const dt=Math.min(clock.getDelta(),.05);
    const a=anchor();renderer.setScissorTest(false);renderer.clear();
    if(a){const w=innerWidth,h=innerHeight,k=halfH/(h/2);
     const x=(a.cx-w/2)*k,y=-(a.cy-h/2)*k,s=a.r*k;
     earth.position.set(x,y,0);earth.scale.setScalar(s);atmo.position.set(x,y,0);atmo.scale.setScalar(s);
     earth.rotation.x+=(py*.22-earth.rotation.x)*.05;earth.rotation.y+=(px*.45-earth.rotation.y)*.05;globe.rotation.y+=dt*.09;clouds.rotation.y+=dt*.105;arcU.time.value+=dt;moonPivot.rotation.y+=dt*.09;moon.visible=innerWidth>=800||!!a.clip;const st=arcU.time.value*.35;sat.position.set(Math.cos(st)*1.45,Math.sin(st)*1.45,0);dots.forEach((m,i)=>m.scale.setScalar(1+.35*Math.sin(arcU.time.value*2+i)));
     sun.position.copy(sunWorld).multiplyScalar(20).add(earth.position);sun.target=earth;
     uni.sunDir.value.copy(sunWorld).transformDirection(cam.matrixWorldInverse);
     stars.visible=!!a.clip&&!!document.querySelector('.login-story')||document.documentElement.dataset.theme==='dark';stars.rotation.y+=dt*.004;
     if(a.clip){renderer.setScissorTest(true);renderer.setScissor(a.clip.left,h-a.clip.bottom,a.clip.width,a.clip.height);if(a.space){renderer.setClearColor(0x07080d,1);renderer.clear();renderer.setClearColor(0x000000,0);}}
     renderer.render(scene,cam);}
    if(!reduce&&!document.hidden)raf=requestAnimationFrame(frame);};
   const vis=()=>{if(!document.hidden&&!reduce){cancelAnimationFrame(raf);clock.getDelta();raf=requestAnimationFrame(frame);}};document.addEventListener('visibilitychange',vis);
   const once=()=>{if(reduce)frame();};addEventListener('scroll',once,{passive:true});
   frame();
   stop=()=>{cancelAnimationFrame(raf);removeEventListener('resize',size);removeEventListener('pointermove',pm);removeEventListener('scroll',once);document.removeEventListener('visibilitychange',vis);renderer.dispose();renderer.domElement.remove();};
  })();
  return()=>{cancelled=true;stop();};
 },[]);
 return <div ref={ref} className="nv-3d" aria-hidden="true"/>;
}
