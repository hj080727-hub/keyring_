const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  img: null,
  material: 'aurora',
  padding: 24,
  hole: 'top',
  ring: 'circle',
  metal: 'silver',
  speed: 11,
  rotation: 0,
  dragging: false,
  dragStartX: 0,
  startRotation: 0
};

const fileInput = $('#fileInput');
const originalPreview = $('#originalPreview');
const cutoutPreview = $('#cutoutPreview');
const keyringImage = $('#keyringImage');
const keyring = $('#keyring');
const hole = $('#hole');
const ring3d = $('#ring3d');
const stage = $('#stage');
const status = $('#status');
const saveStatus = $('#saveStatus');

function pop(el){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

function setStatus(text){ status.textContent = text; }

function loadImage(src){
  return new Promise((resolve,reject)=>{
    const im = new Image();
    im.onload=()=>resolve(im);
    im.onerror=reject;
    im.src=src;
  });
}

function canvasDataURL(canvas){ return canvas.toDataURL('image/png'); }

function roughCutout(img){
  // Lightweight local chroma/edge-style transparency for the demo.
  // Best for plain/bright backgrounds; an AI endpoint can replace this function later.
  const max = 1200, scale = Math.min(1, max / Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas'); c.width=img.naturalWidth*scale; c.height=img.naturalHeight*scale;
  const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height), p=d.data, w=c.width,h=c.height;
  const bgSamples=[];
  for(let yy=0;yy<Math.min(10,h);yy++) for(let xx=0;xx<Math.min(10,w);xx++){let i=(yy*w+xx)*4;bgSamples.push([p[i],p[i+1],p[i+2]])}
  const avg=bgSamples.reduce((a,v)=>[a[0]+v[0],a[1]+v[1],a[2]+v[2]],[0,0,0]).map(v=>v/bgSamples.length);
  for(let y=0;y<h;y++) for(let xx=0;xx<w;xx++){
    let i=(y*w+xx)*4, dr=p[i]-avg[0],dg=p[i+1]-avg[1],db=p[i+2]-avg[2];
    let dist=Math.sqrt(dr*dr+dg*dg+db*db);
    let edge=Math.min(xx,yy,w-1-xx,h-1-yy);
    if(dist<28 && edge<Math.min(w,h)*.25) p[i+3]=0;
    else if(dist<16) p[i+3]=Math.round(p[i+3]*.2);
  }
  x.putImageData(d,0,0); return c.toDataURL('image/png');
}

function extractLine(img){
  const max=1100, scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas'); c.width=img.naturalWidth*scale;c.height=img.naturalHeight*scale;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height),p=d.data,w=c.width,h=c.height;
  const gray=new Uint8ClampedArray(w*h);
  for(let i=0;i<w*h;i++){const j=i*4;gray[i]=(p[j]*.299+p[j+1]*.587+p[j+2]*.114)}
  const out=x.createImageData(w,h);
  for(let y=1;y<h-1;y++) for(let xx=1;xx<w-1;xx++){
    const i=y*w+xx, gx=-gray[i-w-1]-2*gray[i-1]-gray[i+w-1]+gray[i-w+1]+2*gray[i+1]+gray[i+w+1];
    const gy=-gray[i-w-1]-2*gray[i-w]-gray[i-w+1]+gray[i+w-1]+2*gray[i+w]+gray[i+w+1];
    const mag=Math.min(255,Math.sqrt(gx*gx+gy*gy));
    const j=i*4, a=mag>38?Math.min(255,mag*1.7):0;
    out.data[j]=50;out.data[j+1]=38;out.data[j+2]=56;out.data[j+3]=a;
  }
  x.clearRect(0,0,w,h);x.putImageData(out,0,0);return c.toDataURL('image/png');
}

async function handleFile(file){
  if(!file)return;
  const src=URL.createObjectURL(file);
  const img=await loadImage(src);
  state.img=img;
  originalPreview.src=src;
  keyringImage.src=src;
  setStatus('사진을 불러왔어요! 누끼를 준비하는 중…');
  try{
    const cut=roughCutout(img);
    cutoutPreview.src=cut;
    keyringImage.src=cut;
    state.cutout=cut;
    setStatus('누끼 미리보기 완성! 재질을 골라보세요 ✦');
  }catch(e){setStatus('이미지는 불러왔지만 누끼 처리에 실패했어요. 원본을 사용합니다.')}
  pop(keyring); updateKeyring();
}


// ---------- Optional AI processing ----------
// Set your deployed serverless endpoint here, e.g.:
// https://YOUR-WORKER.example.workers.dev/process
const AI_ENDPOINT = "https://keyringapi.hj080727.workers.dev/";

let pendingAI = null;
const aiModal=$('#aiModal'), aiModalPreview=$('#aiModalPreview'), aiModalText=$('#aiModalText');
function openAIModal(mode,url){
  pendingAI={mode,url};
  aiModalPreview.src=url;
  aiModalText.textContent=mode==='cutout' ? '배경이 투명하게 처리되었는지, 캐릭터의 머리카락·의상·소품이 잘 보존되었는지 확인해 주세요.' : '선이 끊기거나 캐릭터 디자인이 바뀌지 않았는지 확인해 주세요.';
  aiModal.hidden=false;
}
function closeAIModal(){aiModal.hidden=true;pendingAI=null;}
function applyPendingAI(){
  if(!pendingAI)return;
  const {mode,url}=pendingAI;
  if(mode==='cutout'){
    state.cutout=url; cutoutPreview.src=url; keyringImage.src=url; setStatus('AI 누끼 결과를 적용했어요 ✦');
  }else{
    state.line=url; cutoutPreview.src=url; keyringImage.src=url; state.material='line'; setMaterialButtons(); updateKeyring(); setStatus('AI 선화 결과를 적용했어요 ✎');
  }
  pop(keyring); closeAIModal();
}
$('#aiAccept').addEventListener('click',applyPendingAI);
$('#aiReject').addEventListener('click',()=>{setStatus('원본 이미지를 유지했어요.');closeAIModal()});
$('#aiRetry').addEventListener('click',()=>{const mode=pendingAI?.mode;closeAIModal();if(mode)aiProcess(mode)});
$('.ai-modal-backdrop').addEventListener('click',()=>{setStatus('원본 이미지를 유지했어요.');closeAIModal()});

async function aiProcess(mode){
  if(!state.img){ setStatus('먼저 사진을 넣어주세요!'); return; }
  if(!AI_ENDPOINT){ setStatus('AI 연결 주소가 아직 설정되지 않았어요. README의 연결 방법을 따라주세요.'); return; }
  const file=fileInput.files?.[0];
  if(!file){setStatus('원본 파일을 다시 선택해주세요.');return;}
  setStatus(mode==='cutout'?'AI가 배경을 지우고 있어요…':'AI가 선화를 만들고 있어요…');
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  try{
    const res=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:dataUrl,mode})});
    if(!res.ok){let msg='AI endpoint error';try{const j=await res.json();msg=j.error||msg}catch{}throw new Error(msg)}
    const blob=await res.blob(); const url=URL.createObjectURL(blob);
    openAIModal(mode,url); setStatus('AI 결과가 준비됐어요! 미리보기에서 확인해 주세요 ✨');
  }catch(err){setStatus('AI 처리에 실패했어요. 잠시 후 다시 시도해주세요.');console.error(err)}
}

fileInput.addEventListener('change',e=>handleFile(e.target.files[0]));
$('#dropzone').addEventListener('dragover',e=>{e.preventDefault();$('#dropzone').style.transform='translateY(-2px)'});
$('#dropzone').addEventListener('dragleave',()=>$('#dropzone').style.transform='');
$('#dropzone').addEventListener('drop',e=>{e.preventDefault();$('#dropzone').style.transform='';handleFile(e.dataTransfer.files[0])});

$('#cutoutBtn').addEventListener('click',async()=>{
  if(AI_ENDPOINT) return aiProcess('cutout');
  if(!state.img){setStatus('먼저 사진을 넣어주세요!');return}
  setStatus('브라우저 누끼를 다시 만들고 있어요…');
  const cut=roughCutout(state.img);state.cutout=cut;cutoutPreview.src=cut;
  keyringImage.src=cut;setStatus('브라우저 누끼가 다시 만들어졌어요 ✦');pop(keyring);updateKeyring();
});

$('#lineBtn').addEventListener('click',async()=>{
  if(AI_ENDPOINT) return aiProcess('line');
  if(!state.img){setStatus('먼저 사진을 넣어주세요!');return}
  setStatus('브라우저 선화를 추출하고 있어요…');
  const line=extractLine(state.img);state.line=line;cutoutPreview.src=line;keyringImage.src=line;
  state.material='line';setMaterialButtons();updateKeyring();setStatus('브라우저 선화 키링이 완성됐어요 ✎');
});

$$('#materialChoices .choice').forEach(b=>b.addEventListener('click',()=>{
  state.material=b.dataset.material;setMaterialButtons();updateKeyring();pop(keyring)
}));
function setMaterialButtons(){$$('#materialChoices .choice').forEach(b=>b.classList.toggle('active',b.dataset.material===state.material));$('#opaqueGroup').hidden=state.material!=='opaque'}

$('#opaqueColor').addEventListener('input',updateKeyring);
$('#padding').addEventListener('input',e=>{state.padding=+e.target.value;$('#paddingValue').textContent=state.padding;updateKeyring()});

$$('.hole-presets .choice').forEach(b=>b.addEventListener('click',()=>{
  state.hole=b.dataset.hole;$$('.hole-presets .choice').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  $('#holeValue').textContent=b.textContent;setHolePreset();pop(hole)
}));
function setHolePreset(){
  if(state.hole==='top'){hole.style.left='50%';hole.style.top='-29px'}
  if(state.hole==='top-left'){hole.style.left='23%';hole.style.top='-29px'}
  if(state.hole==='top-right'){hole.style.left='77%';hole.style.top='-29px'}
}
let holeDrag=false;
hole.addEventListener('pointerdown',e=>{holeDrag=true;hole.classList.add('dragging');hole.setPointerCapture(e.pointerId);state.hole='custom';$$('.hole-presets .choice').forEach(x=>x.classList.toggle('active',x.dataset.hole==='custom'));$('#holeValue').textContent='직접 지정'});
hole.addEventListener('pointermove',e=>{
  if(!holeDrag)return;
  const r=keyring.getBoundingClientRect(), x=Math.max(8,Math.min(r.width-8,e.clientX-r.left)), y=Math.max(8,Math.min(r.height-8,e.clientY-r.top));
  hole.style.left=(x/r.width*100)+'%';hole.style.top=(y/r.height*100-4)+'%';
});
hole.addEventListener('pointerup',()=>{holeDrag=false;hole.classList.remove('dragging')});

$$('#ringChoices .choice').forEach(b=>b.addEventListener('click',()=>{
  state.ring=b.dataset.ring;$$('#ringChoices .choice').forEach(x=>x.classList.toggle('active',x===b));updateRingShape();pop(ring3d)
}));
$$('#metalChoices .choice').forEach(b=>b.addEventListener('click',()=>{
  state.metal=b.dataset.metal;$$('#metalChoices .choice').forEach(x=>x.classList.toggle('active',x===b));updateRingShape();pop(ring3d)
}));
$('#speed').addEventListener('input',e=>{state.speed=+e.target.value;$('#speedValue').textContent=state.speed<=8?'빠르게':state.speed<=12?'천천히':'아주 천천히'});

function updateRingShape(){
  ring3d.className='ring3d shape-'+state.ring+' metal-'+state.metal;
  if(state.ring==='heart') ring3d.textContent='♡';
  else if(state.ring==='star') ring3d.textContent='★';
  else if(state.ring==='moon') ring3d.textContent='☾';
  else if(state.ring==='flower') ring3d.textContent='✿';
  else if(state.ring==='chain') ring3d.textContent='🔗';
  else ring3d.textContent='';
}

function updateKeyring(){
  keyring.className='keyring material-'+state.material;
  keyring.style.width=(190+state.padding*2)+'px';
  keyring.style.height=(240+state.padding*2)+'px';
  if(state.material==='opaque') keyring.style.background=$('#opaqueColor').value;
  keyringImage.src=state.material==='line' ? (state.line||state.cutout||'') : (state.cutout||state.img?.src||'');
  setHolePreset();
  updateRingShape();
}
updateKeyring();

let autoStart=performance.now();
function animate(now){
  const elapsed=(now-autoStart)/1000;
  if(!state.dragging) state.rotation=(elapsed/state.speed)*360%360;
  keyring.style.transform=`rotateY(${state.rotation}deg) rotateX(${Math.sin(elapsed*.8)*1.8}deg)`;
  ring3d.style.transform=`rotateY(${state.rotation}deg) ${state.ring==='heart'?'rotate(-45deg) scale(.72)':''}`;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

stage.addEventListener('pointerdown',e=>{
  if(e.target===hole)return;
  state.dragging=true;state.dragStartX=e.clientX;state.startRotation=state.rotation;stage.setPointerCapture(e.pointerId)
});
stage.addEventListener('pointermove',e=>{
  if(!state.dragging)return;
  state.rotation=state.startRotation+(e.clientX-state.dragStartX)*.65
});
stage.addEventListener('pointerup',()=>state.dragging=false);
stage.addEventListener('pointercancel',()=>state.dragging=false);

function canvasFromStage(){
  const c=document.createElement('canvas'), size=720;c.width=size;c.height=size;
  const x=c.getContext('2d');x.fillStyle='#fffaff';x.fillRect(0,0,size,size);
  x.save();x.translate(size/2,size/2);
  // simple 2D export representation of the current design
  x.shadowColor='rgba(90,65,102,.18)';x.shadowBlur=28;x.shadowOffsetY=18;
  const w=Math.min(370,260+state.padding*2),h=Math.min(470,330+state.padding*2);
  x.fillStyle=state.material==='opaque'?$('#opaqueColor').value:'rgba(255,255,255,.18)';
  x.strokeStyle='rgba(214,187,228,.9)';x.lineWidth=9;
  x.beginPath();x.roundRect(-w/2,-h/2+30,w,h,55);x.fill();x.stroke();x.restore();
  x.shadowColor='transparent';
  if(keyringImage.src){
    const im=new Image();im.src=keyringImage.src;
    return new Promise(resolve=>{im.onload=()=>{x.drawImage(im, size/2-150,size/2-160,300,300);drawRingExport(x);resolve(c)};im.onerror=()=>{drawRingExport(x);resolve(c)}})
  }
  drawRingExport(x);return Promise.resolve(c)
}
function drawRingExport(x){
  x.save();x.strokeStyle=state.metal==='gold'?'#e5c36d':state.metal==='rose'?'#df9faa':state.metal==='black'?'#48414d':'#cfd0d5';x.lineWidth=12;
  x.beginPath();x.arc(360,82,34,0,Math.PI*2);x.stroke();x.restore()
}
$('#savePng').addEventListener('click',async()=>{
  saveStatus.textContent='PNG를 만들고 있어요…';
  const c=await canvasFromStage(),a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='키링공방.png';a.click();
  saveStatus.textContent='PNG 저장 완료! ✦';pop($('#savePng'))
});

function showSpark(x,y){
  for(let i=0;i<9;i++){const s=document.createElement('span');s.textContent=['✦','✧','⋆','♡'][Math.floor(Math.random()*4)];
    s.style.position='fixed';s.style.left=x+'px';s.style.top=y+'px';s.style.zIndex=99;s.style.pointerEvents='none';s.style.color=['#c9a3df','#f0aeca','#b9b3ed'][Math.floor(Math.random()*3)];
    document.body.appendChild(s);const dx=(Math.random()-.5)*110,dy=(Math.random()-.7)*110;s.animate([{transform:'translate(0,0) scale(.6)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(1.2)`,opacity:0}],{duration:500+Math.random()*300,easing:'ease-out'}).onfinish=()=>s.remove()}
}
$$('button').forEach(b=>b.addEventListener('click',e=>showSpark(e.clientX,e.clientY)));



// ================= REAL 3D PREVIEW + GIF EXPORT =================
let three = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let canvasMode = null, canvasStartX = 0, canvasStartRotation = 0;

function hexNumber(hex){ return parseInt(hex.replace('#',''),16); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
state.holeX=.5; state.holeY=.08;

function makeMetalMaterial(color){
  return new THREE.MeshStandardMaterial({color,metalness:.95,roughness:.16});
}

function roundedShape(w,h,r){
  const sh=new THREE.Shape();
  sh.moveTo(-w/2+r,-h/2); sh.lineTo(w/2-r,-h/2);
  sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
  sh.lineTo(w/2,h/2-r); sh.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
  sh.lineTo(-w/2+r,h/2); sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
  sh.lineTo(-w/2,-h/2+r); sh.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  return sh;
}

// Build a real acrylic outline from the uploaded transparent image's alpha channel.
async function makeAlphaSilhouette(url){
  if(!url) return null;
  try{
    const im=await loadImage(url);
    const max=112, sc=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(8,Math.round(im.naturalWidth*sc)), h=Math.max(8,Math.round(im.naturalHeight*sc));
    const c=document.createElement('canvas'); c.width=w;c.height=h;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,w,h);
    const d=ctx.getImageData(0,0,w,h).data, mask=new Uint8Array(w*h);
    let minX=w,maxX=0,minY=h,maxY=0,count=0;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const a=d[(y*w+x)*4+3];
      if(a>28){mask[y*w+x]=1;count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
    }
    if(count<20) return null;
    // Keep only the largest connected component so stray transparent-image specks don't become giant acrylic spikes.
    const seen=new Uint8Array(w*h), comps=[];
    for(let sy=minY;sy<=maxY;sy++) for(let sx=minX;sx<=maxX;sx++){
      const si=sy*w+sx;if(!mask[si]||seen[si])continue;
      const q=[si];seen[si]=1;const comp=[];
      while(q.length){const i=q.pop(),x=i%w,y=(i/w)|0;comp.push(i);
        const ns=[i-1,i+1,i-w,i+w];
        for(const n of ns){if(n<0||n>=w*h||seen[n]||!mask[n])continue;const nx=n%w,ny=(n/w)|0;if(Math.abs(nx-x)+Math.abs(ny-y)!==1)continue;seen[n]=1;q.push(n)}
      }
      comps.push(comp);
    }
    comps.sort((a,b)=>b.length-a.length); const keep=new Uint8Array(w*h);
    for(const i of comps[0]) keep[i]=1;
    const edges=[];
    const add=(ax,ay,bx,by)=>edges.push([[ax,ay],[bx,by]]);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(keep[y*w+x]){
      if(y===0||!keep[(y-1)*w+x]) add(x,y,x+1,y);
      if(x===w-1||!keep[y*w+x+1]) add(x+1,y,x+1,y+1);
      if(y===h-1||!keep[(y+1)*w+x]) add(x+1,y+1,x,y+1);
      if(x===0||!keep[y*w+x-1]) add(x,y+1,x,y);
    }
    const key=(x,y)=>x+','+y, map=new Map();
    edges.forEach((e,i)=>{const k=key(e[0][0],e[0][1]);if(!map.has(k))map.set(k,[]);map.get(k).push(i)});
    const used=new Uint8Array(edges.length), loops=[];
    for(let ei=0;ei<edges.length;ei++) if(!used[ei]){
      const pts=[];let cur=ei,start=edges[ei][0];
      while(!used[cur]){
        used[cur]=1;const e=edges[cur];pts.push(e[0]);const end=e[1];
        if(end[0]===start[0]&&end[1]===start[1])break;
        const arr=map.get(key(end[0],end[1]))||[];cur=arr.find(j=>!used[j]);if(cur===undefined)break;
      }
      if(pts.length>8) loops.push(pts);
    }
    loops.sort((a,b)=>b.length-a.length); const pts=loops[0];
    // RDP simplify while retaining a smooth, recognizable character silhouette.
    function rdp(arr,eps){
      if(arr.length<3)return arr;let max=0,idx=-1,a=arr[0],b=arr[arr.length-1];
      const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1];if(!dx&&!dy)return Math.hypot(p[0]-a[0],p[1]-a[1]);const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy))};
      for(let i=1;i<arr.length-1;i++){const d0=dist(arr[i],a,b);if(d0>max){max=d0;idx=i}}
      if(max>eps){const l=rdp(arr.slice(0,idx+1),eps),r=rdp(arr.slice(idx),eps);return l.slice(0,-1).concat(r)}
      return [a,b];
    }
    const simp=rdp(pts,Math.max(1.5,Math.min(w,h)*.025));
    const bw=maxX-minX+1,bh=maxY-minY+1;
    const shape=new THREE.Shape();
    simp.forEach((p,i)=>{const x=(p[0]-minX)/bw*4.0-2,y=2.5-(p[1]-minY)/bh*5.0;i?shape.lineTo(x,y):shape.moveTo(x,y)});
    shape.closePath();
    const normalized=simp.map(p=>[(p[0]-minX)/bw*4.0-2,2.5-(p[1]-minY)/bh*5.0]);
    return {shape,aspect:im.naturalWidth/im.naturalHeight,bounds:{bw,bh},points:normalized};
  }catch(e){console.warn('silhouette failed',e);return null}
}

function buildShapeMesh(type,material){
  if(type==='circle') return new THREE.Mesh(new THREE.TorusGeometry(.50,.095,20,56),material);
  if(type==='chain'){
    const g=new THREE.Group();
    const a=new THREE.Mesh(new THREE.TorusGeometry(.40,.075,16,44),material);
    const b=new THREE.Mesh(new THREE.TorusGeometry(.40,.075,16,44),material);
    a.rotation.x=.34; b.rotation.x=-.34; b.position.y=-.31; g.add(a,b); return g;
  }
  const sh=new THREE.Shape();
  if(type==='heart'){
    sh.moveTo(0,-.48);sh.bezierCurveTo(-.82,-.05,-.60,.58,0,.35);sh.bezierCurveTo(.60,.58,.82,-.05,0,-.48);
  }else if(type==='star'){
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.25:.55,x=Math.cos(a)*r,y=Math.sin(a)*r;i?sh.lineTo(x,y):sh.moveTo(x,y)}sh.closePath();
  }else if(type==='moon'){
    sh.absarc(0,0,.55,Math.PI*.18,Math.PI*1.82,false);sh.absarc(.18,0,.43,Math.PI*1.82,Math.PI*.18,true);sh.closePath();
  }else{ // rounded flower: smooth six-petal curve, no sharp tips
    const n=72;
    for(let i=0;i<n;i++){
      const a=-Math.PI/2+i*Math.PI*2/n;
      const rr=.43 + .115*Math.cos(a*6);
      const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
      i?sh.lineTo(x,y):sh.moveTo(x,y);
    }
    sh.closePath();
  }
  const geo=new THREE.ExtrudeGeometry(sh,{depth:.12,bevelEnabled:true,bevelSegments:3,bevelSize:.035,bevelThickness:.025});geo.center();
  return new THREE.Mesh(geo,material);
}

function initThree(){
  if(!window.THREE||three)return;
  const canvas=document.getElementById('threeCanvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
  renderer.outputEncoding=THREE.sRGBEncoding;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(31,1,.1,100);camera.position.set(0,0,9.6);
  const group=new THREE.Group();group.scale.set(.72,.72,.72);scene.add(group);
  const hemi=new THREE.HemisphereLight(0xffffff,0xc7a96d,1.45);scene.add(hemi);
  const keyLight=new THREE.DirectionalLight(0xffffff,2.5);keyLight.position.set(-4,5,7);scene.add(keyLight);
  const rim=new THREE.PointLight(0xf0b6e7,1.5,14);rim.position.set(4,1,4);scene.add(rim);
  const warm=new THREE.PointLight(0xffdf9a,.7,12);warm.position.set(-3,-2,3);scene.add(warm);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.7,48),new THREE.MeshBasicMaterial({color:0x7b6643,transparent:true,opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.15;floor.scale.y=.28;scene.add(floor);

  let silhouette=null, acrylic=null, edge=null, imgPlane=null, backImgPlane=null, tintPlane=null, ringMesh=null, connectorMesh=null;
  const hardware=new THREE.Group();group.add(hardware);
  const holeMesh=new THREE.Mesh(new THREE.TorusGeometry(.15,.052,14,32),makeMetalMaterial(0xd7d8dc));group.add(holeMesh);
  const metalColors={silver:0xd7d8dc,gold:0xe4bd5d,rose:0xdf9fa9,black:0x403b42};
  const defaultShape=roundedShape(4,5,.42);

  function resize(){const w=canvas.clientWidth||600,h=canvas.clientHeight||450;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas.parentElement);else window.addEventListener('resize',resize);resize();

  function makeImageMaterial(){return new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,toneMapped:false})}
  function textureFromURL(url){if(!url||!imgPlane)return;new THREE.TextureLoader().load(url,tex=>{tex.encoding=THREE.sRGBEncoding;imgPlane.material.map=tex;imgPlane.material.needsUpdate=true;if(backImgPlane){backImgPlane.material.map=tex;backImgPlane.material.needsUpdate=true}})}

  function acrylicScale(){return {x:(190+state.padding*2)/230,y:(240+state.padding*2)/290}}
  function currentShape(){return silhouette?.shape||defaultShape}

  function rebuildAcrylic(){
    if(acrylic){group.remove(acrylic);acrylic.geometry.dispose();acrylic.material.dispose()}
    if(edge){group.remove(edge);edge.geometry.dispose();edge.material.dispose()}
    const geo=new THREE.ExtrudeGeometry(currentShape(),{depth:.18,bevelEnabled:true,bevelSegments:3,bevelSize:.055,bevelThickness:.04,curveSegments:3});geo.center();
    acrylic=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.22,roughness:.12,metalness:.02,clearcoat:1,clearcoatRoughness:.08,side:THREE.DoubleSide}));acrylic.position.z=-.10;group.add(acrylic);
    edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0xf0d9a0,transparent:true,opacity:.9}));edge.position.copy(acrylic.position);group.add(edge);
    if(imgPlane)group.remove(imgPlane);if(backImgPlane)group.remove(backImgPlane);
    imgPlane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),makeImageMaterial());
    imgPlane.position.z=.018;group.add(imgPlane);
    // A real double-sided print: a second outward-facing plane sits on the back.
    // Rotating the back plane 180° keeps the artwork readable from either side.
    backImgPlane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),makeImageMaterial());
    backImgPlane.position.z=-.205;backImgPlane.rotation.y=Math.PI;group.add(backImgPlane);
    if(tintPlane)group.remove(tintPlane);tintPlane=new THREE.Mesh(new THREE.ExtrudeGeometry(currentShape(),{depth:.012,bevelEnabled:false}),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide}));tintPlane.position.z=.075;group.add(tintPlane);
    three.acrylic=acrylic;three.edge=edge;three.imgPlane=imgPlane;three.backImgPlane=backImgPlane;three.tintPlane=tintPlane;
    textureFromURL(state.material==='line'?(state.line||state.cutout):state.cutout||state.img?.src);
    updateGeometry();materialUpdate();
  }

  function materialUpdate(){
    if(!acrylic)return;
    const mat=acrylic.material;
    if(state.material==='aurora'){mat.color.set(0xf3d7ff);mat.opacity=.27;mat.roughness=.09;rim.color.set(0xef9fdc);tintPlane.material.color.set(0xd8b4ff);tintPlane.material.opacity=.07}
    else if(state.material==='pearl'){mat.color.set(0xfff0d8);mat.opacity=.40;mat.roughness=.18;rim.color.set(0xffdfa0);tintPlane.material.color.set(0xffe8c7);tintPlane.material.opacity=.075}
    else if(state.material==='clear'){mat.color.set(0xffffff);mat.opacity=.12;mat.roughness=.055;rim.color.set(0xffffff);tintPlane.material.color.set(0xffffff);tintPlane.material.opacity=.025}
    else if(state.material==='line'){mat.color.set(0xffffff);mat.opacity=.075;mat.roughness=.07;rim.color.set(0xd4b8ed);tintPlane.material.color.set(0xffffff);tintPlane.material.opacity=.018}
    else{mat.color.set(hexNumber($('#opaqueColor').value));mat.opacity=.94;mat.roughness=.24;rim.color.set(0xffd98e);tintPlane.material.color.set(hexNumber($('#opaqueColor').value));tintPlane.material.opacity=.10}
    mat.needsUpdate=true;tintPlane.material.needsUpdate=true;
  }

  function metalUpdate(){
    const color=metalColors[state.metal]||metalColors.silver,mat=makeMetalMaterial(color);
    if(ringMesh){hardware.remove(ringMesh);ringMesh.traverse(o=>o.geometry?.dispose())}
    if(connectorMesh){hardware.remove(connectorMesh);connectorMesh.geometry?.dispose()}
    ringMesh=buildShapeMesh(state.ring,mat);ringMesh.position.z=.18;hardware.add(ringMesh);
    connectorMesh=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.62,14),mat);connectorMesh.position.z=.18;hardware.add(connectorMesh);
    updateGeometry();
  }

  function pointInPoly(x,y,pts){
    if(!pts||pts.length<3)return true;let inside=false;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){
      const xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
      const hit=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-9)+xi);if(hit)inside=!inside;
    }
    return inside;
  }
  function fitHoleInside(x,y,sc){
    const pts=silhouette?.points;if(!pts)return {x,y};
    // Keep a little breathing room from the outer acrylic edge.
    const safe=(px,py)=>pointInPoly(px,py,pts);
    if(safe(x,y))return {x,y};
    const cx=0,cy=0;let lo=0,hi=1;
    for(let i=0;i<18;i++){const m=(lo+hi)/2,px=cx+(x-cx)*m,py=cy+(y-cy)*m;if(safe(px,py))lo=m;else hi=m}
    return {x:cx+(x-cx)*Math.max(0,lo-.025),y:cy+(y-cy)*Math.max(0,lo-.025)};
  }

  function updateGeometry(){
    const sc=acrylicScale();acrylic?.scale.set(sc.x,sc.y,1);edge?.scale.set(sc.x,sc.y,1);tintPlane?.scale.set(sc.x,sc.y,1);
    const halfW=2*sc.x,halfH=2.5*sc.y,margin=.25;
    let x=clamp((state.holeX-.5)*4*sc.x,-halfW+margin,halfW-margin), y=clamp((.5-state.holeY)*5*sc.y,-halfH+margin,halfH-margin);
    const fitted=fitHoleInside(x/sc.x,y/sc.y,sc);x=fitted.x*sc.x;y=fitted.y*sc.y;
    holeMesh.position.set(x,y,.22);
    const ringY=y+.78;if(ringMesh)ringMesh.position.set(x,ringY,.23);
    if(connectorMesh){connectorMesh.position.set(x,y+.39,.22);connectorMesh.scale.y=Math.max(.15,(ringY-y)/.62)}
    if(imgPlane){
      const aspect=silhouette?.aspect||((state.img?.naturalWidth||1)/(state.img?.naturalHeight||1));
      const targetH=silhouette?4.55:4.2; imgPlane.scale.set(targetH*aspect,targetH,1);
      // Fit the same print on both faces so the back has exactly the same size.
      const maxW=3.45,maxH=4.55,fit=Math.min(maxW/(targetH*aspect),maxH/targetH,1);imgPlane.scale.multiplyScalar(fit);
      if(backImgPlane){backImgPlane.scale.copy(imgPlane.scale);backImgPlane.position.x=imgPlane.position.x;backImgPlane.position.y=imgPlane.position.y;}
    }
  }

  function updateSilhouette(){
    const url=state.cutout||state.img?.src;
    makeAlphaSilhouette(url).then(sil=>{silhouette=sil;rebuildAcrylic()});
  }

  function render(){
    resize();
    const t=performance.now()/1000;
    if(state.material==='aurora'){rim.position.x=3.5+Math.sin(t*1.15)*2.7;rim.position.y=1+Math.cos(t*.8)*1.2}
    else if(state.material==='pearl'){rim.position.x=3+Math.sin(t*1.8)*1.4;rim.position.y=1.5}
    else rim.position.x=3.5;
    if(tintPlane && state.material==='pearl')tintPlane.material.opacity=.045+.025*(Math.sin(t*2.2)+1);
    if(tintPlane && state.material==='aurora')tintPlane.material.opacity=.045+.035*(Math.sin(t*1.7)+1)/2;
    group.rotation.y=state.rotation*Math.PI/180;group.rotation.x=Math.sin(t*.75)*.022;
    renderer.render(scene,camera);requestAnimationFrame(render);
  }

  three={renderer,scene,camera,group,hardware,holeMesh,textureFromURL,materialUpdate,metalUpdate,updateGeometry,updateSilhouette,rebuildAcrylic,get silhouette(){return silhouette}};
  rebuildAcrylic();metalUpdate();render();
}
setTimeout(initThree,50);

const originalUpdateKeyring=updateKeyring;
updateKeyring=function(){
  originalUpdateKeyring();
  if(three){
    three.materialUpdate();
    three.textureFromURL(state.material==='line'?(state.line||state.cutout):state.cutout||state.img?.src);
    three.metalUpdate();three.updateGeometry();
    if(state.cutout||state.img)three.updateSilhouette();
  }
};

const oldHolePreset=setHolePreset;
setHolePreset=function(){
  oldHolePreset();
  if(state.hole==='top'){state.holeX=.5;state.holeY=.08}
  else if(state.hole==='top-left'){state.holeX=.23;state.holeY=.08}
  else if(state.hole==='top-right'){state.holeX=.77;state.holeY=.08}
  if(three)three.updateGeometry();
};

const oldRingShape=updateRingShape;
updateRingShape=function(){oldRingShape();if(three)three.metalUpdate()};

function pointerToLocal(e){
  if(!three)return null;const r=three.renderer.domElement.getBoundingClientRect();
  pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,three.camera);
  const plane=new THREE.Plane(new THREE.Vector3(0,0,1),0),world=new THREE.Vector3();if(!raycaster.ray.intersectPlane(plane,world))return null;return three.group.worldToLocal(world);
}
function isNearHole(local){if(!three||!local)return false;const p=three.holeMesh.position;return Math.hypot(local.x-p.x,local.y-p.y)<.42}
const canvas=document.getElementById('threeCanvas');
canvas.addEventListener('pointerdown',e=>{if(!three)return;const local=pointerToLocal(e);if(isNearHole(local)){canvasMode='hole'}else{canvasMode='rotate';canvasStartX=e.clientX;canvasStartRotation=state.rotation;state.dragging=true}canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor='grabbing'});
canvas.addEventListener('pointermove',e=>{
  if(!three||!canvasMode)return;
  if(canvasMode==='rotate'){state.rotation=canvasStartRotation+(e.clientX-canvasStartX)*.65;return}
  const local=pointerToLocal(e);if(!local)return;const sc=acrylicScale(),halfW=2*sc.x,halfH=2.5*sc.y,margin=.28;
  const x=clamp(local.x,-halfW+margin,halfW-margin),y=clamp(local.y,-halfH+margin,halfH-margin);
  state.holeX=clamp(x/(4*sc.x)+.5,.07,.93);state.holeY=clamp(.5-y/(5*sc.y),.07,.93);state.hole='custom';$$('.hole-presets .choice').forEach(x=>x.classList.toggle('active',x.dataset.hole==='custom'));$('#holeValue').textContent='직접 지정';three.updateGeometry();
});
function endCanvasDrag(){canvasMode=null;state.dragging=false;canvas.style.cursor='grab'}
canvas.addEventListener('pointerup',endCanvasDrag);canvas.addEventListener('pointercancel',endCanvasDrag);canvas.style.cursor='grab';

// Fast GIF: smaller render target, fewer frames, and no long JS-side yielding. gif.js does the heavy encoding in workers.
$('#saveGif').onclick=async ev=>{
  showSpark(ev.clientX,ev.clientY);
  if(!three||!window.GIF){saveStatus.textContent='3D/GIF 모듈을 불러오지 못했어요.';return}
  saveStatus.textContent='빠른 GIF를 준비하고 있어요… ✨';
  const W=360,H=360,gif=new GIF({workers:2,quality:12,width:W,height:H,workerScript:'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',background:'#fffdf4'});
  const frames=24,oldRot=state.rotation,oldW=three.renderer.domElement.width,oldH=three.renderer.domElement.height;
  const delay=Math.max(45,Math.round((state.speed*1000)/frames));
  three.renderer.setSize(W,H,false);
  for(let i=0;i<frames;i++){
    state.rotation=i/frames*360;three.group.rotation.y=state.rotation*Math.PI/180;three.renderer.render(three.scene,three.camera);
    gif.addFrame(three.renderer.domElement,{copy:true,delay});
  }
  state.rotation=oldRot;three.renderer.setSize(canvas.clientWidth||600,canvas.clientHeight||450,false);
  gif.on('progress',p=>saveStatus.textContent=`GIF 만들기… ${Math.round(p*100)}% ✨`);
  gif.on('finished',blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='키링공방_360.gif';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);saveStatus.textContent='360° GIF 저장 완료! ♥︎'});
  gif.render();
};

// Better PNG export: render the actual 3D scene instead of a flat illustration.
$('#savePng').onclick=async ev=>{
  showSpark(ev.clientX,ev.clientY);saveStatus.textContent='3D 키링 PNG를 만들고 있어요… ✨';
  if(three){
    const W=720,H=720,oldRot=state.rotation;three.renderer.setSize(W,H,false);three.group.rotation.y=state.rotation*Math.PI/180;three.renderer.render(three.scene,three.camera);
    const a=document.createElement('a');a.href=three.renderer.domElement.toDataURL('image/png');a.download='키링공방_3D.png';a.click();state.rotation=oldRot;three.renderer.setSize(canvas.clientWidth||600,canvas.clientHeight||450,false);saveStatus.textContent='3D 키링 PNG 저장 완료! ✦';return;
  }
  saveStatus.textContent='3D 미리보기를 불러오는 중이에요…';
};
