const $=id=>document.getElementById(id);
const el=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node};
let state, lesson, cue=0, clipURL, timer, running=false;
const drafts=new Map(), clips=new Map();
async function api(path,data){
 const response=await fetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Request failed');return result;
}
function note(message){$('notice').textContent=message;clearTimeout(timer);timer=setTimeout(()=>$ ('notice').textContent='',5000)}
function cues(){return [lesson.task,lesson.hint,lesson.example]}
function showCue(i){cue=Math.max(0,Math.min(2,i));$('step').textContent=['01 / GOAL','02 / TRACE','03 / EXAMPLE'][cue];$('cue').textContent=cues()[cue]}
function choose(id){
 if(lesson)drafts.set(lesson.id,$('editor').value);
 lesson=state.lessons.find(l=>l.id===id)||state.lessons[0];
 $('pick').value=lesson.id;$('title').textContent=lesson.title;$('lang').textContent=lesson.language;
 $('task').textContent=lesson.task;$('editor').value=drafts.get(lesson.id)??state.work.find(w=>w.lesson===lesson.id)?.code??lesson.starter;
 $('out').textContent='Ready to run.';$('preview').hidden=true;showCue(0);
 const video=$('video');video.pause();video.removeAttribute('src');if(clipURL)URL.revokeObjectURL(clipURL);
 const file=clips.get(lesson.id);if(file){clipURL=URL.createObjectURL(file);video.src=clipURL}video.load();$('clip').value='';
}
function render(){
 $('account').textContent=state.user?state.user+' · Sign out':'Sign in';
 $('mode').textContent=state.ai?'AI tutor · Ask about the lesson or another topic.':'Lesson guide · Built-in hints. Configure an AI key for open-ended questions.';
 $('progress').textContent=state.work.filter(w=>w.done).length+' / '+state.lessons.length+' lessons complete';
 $('cards').replaceChildren();$('pick').replaceChildren();
 state.lessons.forEach(l=>$('pick').add(new Option(l.language+' · '+l.title,l.id)));
 [...new Set(state.lessons.map(l=>l.language))].forEach((lang,i)=>{
  const items=state.lessons.filter(l=>l.language===lang),completed=items.filter(l=>state.work.some(w=>w.lesson===l.id&&w.done));
  const card=el('button','');card.className='card';const icon=el('span',['⌁','[ ]','</>','{ }','Aa','⚛','▤'][i]);icon.className='icon';card.append(icon,el('b',lang),el('small',completed.length+' / '+items.length+' complete ↗'));
  card.onclick=()=>{choose((items.find(l=>!completed.includes(l))||items[0]).id);location.hash='studio'};$('cards').append(card)
 });
 $('posts').replaceChildren();
 state.posts.forEach(p=>{const node=el('div','');node.className='post';node.append(el('small',p.name+' · #'+p.id+(p.parent?' · reply to #'+p.parent:'')),el('p',p.body));const reply=el('button','Reply');reply.onclick=()=>{$('postform').dataset.parent=p.id;$('message').placeholder='Reply to #'+p.id;$('message').focus()};node.append(reply);$('posts').append(node)});
 if(!state.posts.length)$('posts').append(el('p','No discussions yet. Start one above.'));
 if(lesson)$('pick').value=lesson.id;
}
async function refresh(){state=await api('studio');render()}
$('pick').onchange=e=>choose(e.target.value);
$('clip').onchange=e=>{const f=e.target.files[0];if(!f)return;clips.set(lesson.id,f);choose(lesson.id)};
$('speed').onchange=e=>$('video').playbackRate=Number(e.target.value);
$('video').ontimeupdate=()=>{const v=$('video');if(v.duration)showCue(Math.floor(v.currentTime/v.duration*3))};
function seek(i){showCue(i);const v=$('video');if(v.duration)v.currentTime=v.duration*cue/3}
$('prev').onclick=()=>seek(cue-1);$('next').onclick=()=>seek(cue+1);
function isolated(code,language){
 return new Promise(resolve=>{const frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('sandbox','allow-scripts');frame.src='runner.html';
 const receive=e=>{if(e.source===frame.contentWindow)finish(e.data)};
 const finish=data=>{clearTimeout(timeout);removeEventListener('message',receive);frame.remove();resolve(data)};
 const timeout=setTimeout(()=>finish({ok:false,output:'The runtime did not respond.'}),65000);
 addEventListener('message',receive);frame.onload=()=>frame.contentWindow.postMessage({code,language},'*');document.body.append(frame)})
}
function htmlResult(id,code){
 const frame=$('preview');frame.hidden=false;frame.srcdoc='<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;">'+code;
 const doc=new DOMParser().parseFromString(code,'text/html');
 if(id==='html-title')return doc.querySelector('h1')?.textContent.trim()==='Signal Studio';
 const checker=document.createElement('iframe');checker.setAttribute('sandbox','allow-same-origin');checker.hidden=true;document.body.append(checker);
 const test=checker.contentDocument;test.open();test.write('<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;">'+code);test.close();
 const p=test.querySelector('p'),pass=!!p&&checker.contentWindow.getComputedStyle(p).color==='rgb(0, 128, 0)';checker.remove();return pass;
}
$('run').onclick=async()=>{
 if(running)return;running=true;const item=lesson,code=$('editor').value;$('run').disabled=true;$('out').textContent='Running…';
 try{let pass,output;
 if(['Tech ASL','React','Databases'].includes(item.language)){const normalize=s=>s.trim().replace(/;$/,'').replace(/\s+/g,' ').toLowerCase();pass=normalize(code)===normalize(item.target);output=pass?'Correct.':item.hint}
 else if(item.language==='HTML/CSS'){pass=htmlResult(item.id,code);output='Preview updated.'}
 else{const result=item.language==='Java'?await api('java',{lesson:item.id,code}):await isolated(code,item.language);output=result.output;pass=result.ok&&String(output).trim()===item.target}
 if(lesson===item)$('out').textContent=(pass?'✓ Challenge passed':'Try again · '+item.task)+'\n\n'+output;
 if(state.user){await api('work',{lesson:item.id,code,done:pass});await refresh()}else if(pass)note('Sign in and run again to record completion.');
 }catch(e){note(e.message);$('out').textContent=e.message}finally{running=false;$('run').disabled=false}
};
$('save').onclick=async()=>{try{await api('work',{lesson:lesson.id,code:$('editor').value});note('Draft saved.')}catch(e){note(e.message)}};
$('account').onclick=async()=>{if(!state?.user){$('auth').showModal();return}try{await api('logout',{});drafts.clear();lesson=null;await refresh();choose(state.lessons[0].id)}catch(e){note(e.message)}};
$('login').onsubmit=async e=>{e.preventDefault();try{await api(e.submitter.value,{email:$('email').value,name:$('name').value||'Learner',password:$('pwd').value});$('auth').close();$('pwd').value='';$('authmsg').textContent='';const id=lesson.id;drafts.clear();lesson=null;await refresh();choose(id)}catch(err){$('authmsg').textContent=err.message}};
$('bot').onclick=()=>$('chat').showModal();
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('ask').onsubmit=async e=>{e.preventDefault();const q=$('question').value.trim();if(!q)return;const btn=e.submitter;btn.disabled=true;$('question').value='';$('log').append(el('p',q));try{const r=await api('tutor',{question:q,lesson:lesson.id,code:$('editor').value});$('log').append(el('p',r.mode+'\n'+r.answer))}catch(err){$('log').append(el('p',err.message))}finally{btn.disabled=false;$('log').scrollTop=$('log').scrollHeight}};
$('postform').onsubmit=async e=>{e.preventDefault();try{await api('post',{body:$('message').value,parent:Number(e.target.dataset.parent)||null});$('message').value='';$('message').placeholder='';delete $('postform').dataset.parent;await refresh()}catch(err){note(err.message)}};
refresh().then(()=>choose(new URLSearchParams(location.search).get('lesson')||state.lessons.find(l=>!state.work.some(w=>w.lesson===l.id&&w.done))?.id)).catch(e=>note(e.message));

