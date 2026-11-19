(()=>{
// Build a tube along a 2:3 torus knot. Project and depth-sort its quadrilateral faces.
const canvas=document.querySelector('#sculpt'), ctx=canvas.getContext('2d');
const segments=150, sides=12, rings=[];
let helix=false; function spine(t){if(helix){const r=1+.24*Math.cos(7*t);return [r*Math.cos(t),r*Math.sin(t),.45*Math.sin(7*t)]}const r=1.07+.47*Math.cos(3*t);return [r*Math.cos(2*t),r*Math.sin(2*t),.65*Math.sin(3*t)]}
function norm(v){const m=Math.hypot(...v);return v.map(n=>n/m)}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function build(){rings.length=0;for(let i=0;i<segments;i++){
 const t=i*2*Math.PI/segments,p=spine(t),q=spine(t+.001),tangent=norm(q.map((v,j)=>v-p[j]));
 const n=norm(cross(tangent,[0,0,1])),b=cross(tangent,n);
 rings.push(Array.from({length:sides},(_,j)=>p.map((v,k)=>v+.18*(n[k]*Math.cos(j*2*Math.PI/sides)+b[k]*Math.sin(j*2*Math.PI/sides)))));
}
} build(); let angle=.35,play=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,drag=null;
const motion=document.querySelector('#motion');
function render(now){
 if(play&&last)angle+=Math.min(now-last,50)*.00018;
 last=now;
 const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio,2);
 if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}
 ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
 const faces=[],scale=Math.min(w/4,h/3.8);
 const mesh=rings.map(r=>r.map(([x,y,z])=>{const a=x*Math.cos(angle)-z*Math.sin(angle),c=x*Math.sin(angle)+z*Math.cos(angle);return [a,.84*y-.54*c,.54*y+.84*c]}));
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const k=(i+1)%segments,l=(j+1)%sides,v=[mesh[i][j],mesh[k][j],mesh[k][l],mesh[i][l]];faces.push({v,z:v.reduce((s,p)=>s+p[2],0),i,j})}
 faces.sort((a,b)=>a.z-b.z);
 for(const {v,i,j} of faces){const sub=(a,b)=>a.map((x,k)=>x-b[k]);const n=norm(cross(sub(v[1],v[0]),sub(v[3],v[0])));const light=42+22*(.35*n[0]-.6*n[1]+.65*n[2])+(i%5===0?8:0);ctx.fillStyle='hsl('+(73+j*1.6)+' 57% '+light+'%)';ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.6;ctx.beginPath();v.forEach(([x,y,z],k)=>{const p=5/(5-z*.28);ctx[k?'lineTo':'moveTo'](w/2+x*scale*p,h*.48+y*scale*p)});ctx.closePath();ctx.fill();ctx.stroke()}
 if(play)requestAnimationFrame(render)
}
function label(){motion.textContent=play?'Pause motion':'Play motion'}
motion.onclick=()=>{play=!play;last=0;label();if(play)requestAnimationFrame(render)};
canvas.onpointerdown=e=>{drag=e.clientX;canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(drag!==null){angle+=(e.clientX-drag)*.014;drag=e.clientX;if(!play)render(performance.now())}};
canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
const switcher=document.createElement('button');switcher.textContent='Next model';motion.before(switcher);switcher.onclick=()=>{helix=!helix;build();document.querySelector('.plate span').textContent=helix?'FIG. 02 / WAVE RING':'FIG. 01 / SIGNAL KNOT';if(!play)render(performance.now())};
new ResizeObserver(()=>{if(!play)render(performance.now())}).observe(canvas);label();requestAnimationFrame(render);

})();