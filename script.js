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

fileInput.addEventListener('change',e=>handleFile(e.target.files[0]));
$('#dropzone').addEventListener('dragover',e=>{e.preventDefault();$('#dropzone').style.transform='translateY(-2px)'});
$('#dropzone').addEventListener('dragleave',()=>$('#dropzone').style.transform='');
$('#dropzone').addEventListener('drop',e=>{e.preventDefault();$('#dropzone').style.transform='';handleFile(e.dataTransfer.files[0])});

$('#cutoutBtn').addEventListener('click',async()=>{
  if(!state.img){setStatus('먼저 사진을 넣어주세요!');return}
  setStatus('누끼를 다시 만들고 있어요…');
  const cut=roughCutout(state.img);state.cutout=cut;cutoutPreview.src=cut;
  keyringImage.src=cut;setStatus('누끼가 다시 만들어졌어요 ✦');pop(keyring);updateKeyring();
});

$('#lineBtn').addEventListener('click',async()=>{
  if(!state.img){setStatus('먼저 사진을 넣어주세요!');return}
  setStatus('선화를 추출하고 있어요…');
  const line=extractLine(state.img);state.line=line;cutoutPreview.src=line;keyringImage.src=line;
  state.material='line';setMaterialButtons();updateKeyring();setStatus('선화 키링이 완성됐어요 ✎');
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

$('#saveGif').addEventListener('click',async()=>{
  saveStatus.textContent='GIF를 준비하고 있어요…';
  // Browser-only animated WebM/GIF-like recording fallback.
  // Native GIF encoding without a third-party library is not universally supported.
  // We record a looping video when MediaRecorder is available and name it .webm.
  const canvas=document.createElement('canvas');canvas.width=520;canvas.height=520;
  const ctx=canvas.getContext('2d');const stream=canvas.captureStream(18);
  const chunks=[];let rec;
  try{rec=new MediaRecorder(stream,{mimeType:'video/webm'});}catch{rec=new MediaRecorder(stream)}
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{
    const blob=new Blob(chunks,{type:'video/webm'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='키링공방_회전.webm';a.click();
    saveStatus.textContent='회전 영상 저장 완료! (브라우저에서 GIF 변환이 필요할 수 있어요.)';
  };
  rec.start();
  const start=performance.now(), duration=state.speed*1000;
  function frame(t){
    const p=Math.min(1,(t-start)/duration), ang=p*Math.PI*2;
    ctx.clearRect(0,0,520,520);ctx.fillStyle='#fffaff';ctx.fillRect(0,0,520,520);
    ctx.save();ctx.translate(260,260);
    ctx.fillStyle=state.material==='opaque'?$('#opaqueColor').value:'rgba(255,255,255,.22)';
    ctx.strokeStyle='#dcc5e7';ctx.lineWidth=8;
    const w=250,h=330, squash=Math.abs(Math.cos(ang))*.8+.2;
    ctx.scale(squash,1);ctx.beginPath();ctx.roundRect(-w/2,-h/2+35,w,h,48);ctx.fill();ctx.stroke();ctx.restore();
    if(keyringImage.src){const im=new Image();im.onload=()=>ctx.drawImage(im,135,130,250,250);im.src=keyringImage.src}
    if(t-start<duration)requestAnimationFrame(frame);else rec.stop()
  }
  requestAnimationFrame(frame);
});
