// Optional enhanced editor, loaded on request so the base studio works offline.
const editorLabel=document.querySelector('label[for="editor"]');
const enhance=el('button','Enable syntax tools');enhance.type='button';editorLabel.after(enhance);
let cm;
function script(src){return new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(Error('Editor download unavailable.'));document.head.append(s)})}
const cmBase='https://cdn.jsdelivr.net/npm/codemirror@5.65.16/';
enhance.onclick=async()=>{enhance.disabled=true;try{
 const css=document.createElement('link');css.rel='stylesheet';css.href=cmBase+'lib/codemirror.css';document.head.append(css);
 await script(cmBase+'lib/codemirror.js');
 for(const file of ['mode/javascript/javascript','mode/python/python','mode/xml/xml','mode/css/css','mode/htmlmixed/htmlmixed','mode/clike/clike','addon/hint/show-hint','addon/hint/anyword-hint'])await script(cmBase+file+'.js');
 const hintCSS=css.cloneNode();hintCSS.href=cmBase+'addon/hint/show-hint.css';document.head.append(hintCSS);
 cm=CodeMirror.fromTextArea($('editor'),{lineNumbers:true,extraKeys:{'Ctrl-Space':'autocomplete','Esc':()=>enhance.focus()}});
 cm.on('change',()=>cm.save());syncEditor();enhance.textContent='Return to plain editor';enhance.disabled=false;
 enhance.onclick=()=>{cm.toTextArea();cm=null;enhance.hidden=true};
 }catch(e){note(e.message);enhance.disabled=false}};
function syncEditor(){if(!cm)return;cm.setOption('mode',{'Python':'python','JavaScript':'javascript','HTML/CSS':'htmlmixed','Java':'text/x-java'}[lesson.language]);cm.setValue($('editor').value)}
const baseChoose=choose;choose=id=>{baseChoose(id);syncEditor()};
const detail=document.querySelector('aside details');
const resource=el('a','Watch a Python project in Indian Sign Language ↗');resource.href='https://www.youtube.com/watch?v=VsnFbywWAcI';resource.target='_blank';resource.rel='noopener';resource.style.textDecoration='underline';detail.append(resource);
const timing=el('label','Optional cue timestamps (.vtt)');const upload=document.createElement('input');upload.type='file';upload.accept='.vtt,text/vtt';timing.append(upload);detail.append(timing);
const tracks=new Map();
const seconds=s=>s.split(':').reduce((total,v)=>total*60+Number(v),0);
upload.onchange=async()=>{try{const file=upload.files[0];if(!file)return;const text=await file.text();
 const marks=[...text.matchAll(/^(\S+)\s+-->\s+(\S+)/gm)].map(m=>seconds(m[1]));
 if(marks.length!==3||marks.some((v,i)=>!Number.isFinite(v)||v<0||(i&&v<=marks[i-1])))throw Error('Use three ascending WebVTT cues.');
 tracks.set(lesson.id,marks);note('Lesson timestamps attached.')}catch(e){note(e.message)}};
const defaultTime=$('video').ontimeupdate;$('video').ontimeupdate=()=>{const marks=tracks.get(lesson.id);if(!marks)return defaultTime();showCue(marks.filter(x=>x<=$('video').currentTime).length-1)};
const baseSeek=seek;seek=i=>{const marks=tracks.get(lesson.id);if(!marks)return baseSeek(i);showCue(i);if($('video').duration)$('video').currentTime=marks[cue]};

