(() => {
  const dialog = document.querySelector('#resource');
  const body = document.querySelector('#resourceBody');
  const node = (tag, text) => Object.assign(document.createElement(tag), {textContent:text});
  function panel(title) {
    document.querySelector('#resourceTitle').textContent = title;
    body.replaceChildren();
    dialog.showModal();
  }
  document.querySelector('#dismiss').onclick = () => dialog.close();
  async function request(path, payload) {
    const response = await fetch('/api/' + path, payload && {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Unable to load this resource.');
    return data;
  }
  function enquiry(topic) {
    panel(topic);
    const form = node('form','');
    const email = node('input',''), message = node('textarea','');
    email.type = 'email'; email.required = message.required = true; message.maxLength = 2000;
    for (const [text, control] of [['Email',email],['Message',message]]) {
      const label = node('label',text); label.append(control); form.append(label);
    }
    const submit = node('button','Save request'), status = node('p','');
    status.setAttribute('role','status');
    form.append(submit,status); body.append(node('p','This request is saved on this installation for its administrator.'),form);
    form.onsubmit = async e => {
      e.preventDefault(); submit.disabled = true;
      try {
        const result = await request('enquiry',{topic,email:email.value,body:message.value});
        form.replaceWith(node('p','Request saved. Reference #'+result.reference));
      } catch (err) {status.textContent = err.message; submit.disabled = false;}
    };
  }
  const prices = document.querySelectorAll('.pbtn');
  prices[1].textContent='Request Pro access'; prices[1].onclick=()=>enquiry('Pro access');
  prices[2].onclick=()=>enquiry('Institutional access');
  const tabs = [...document.querySelectorAll('.tab-pill')].map(span=>{
    const button=node('button',span.textContent); button.className=span.className; span.replaceWith(button); return button;
  });
  let selected = 0;
  const editor = document.querySelector('.ed-body');
  const original = editor.innerHTML;
  tabs.forEach((button,index)=>button.onclick=async()=>{
    selected=index;
    tabs.forEach((b,i)=>{b.classList.toggle('active',i===index); b.setAttribute('aria-pressed',String(i===index));});
    if (!index) {editor.innerHTML=original;return;}
    editor.textContent='Loading…';
    try {
      const files=await request('playground');
      if(selected===index)editor.replaceChildren(node('pre',files[button.textContent]));
    } catch(err){if(selected===index)editor.textContent=err.message;}
  });
  document.querySelectorAll('.asl-k,.agc').forEach(cell=>{
    const letter=cell.querySelector('.lt').textContent;
    const btn=node('button','');btn.className=cell.className;btn.replaceChildren(...cell.childNodes);
    btn.setAttribute('aria-label','Practise letter '+letter);cell.replaceWith(btn);
    btn.onclick=()=>{
      panel('Fingerspelling practice · '+letter);
      const words={A:'array',B:'binary',C:'class',D:'data',E:'editor',F:'function',G:'graph',H:'heap',I:'index',J:'join',K:'key',L:'loop',M:'method',N:'node',O:'object',P:'print',Q:'queue',R:'return',S:'stack',T:'tree',U:'union',V:'value',W:'while',X:'xor',Y:'yield',Z:'zero'};
      body.append(node('p','Practise fingerspelling the coding word '+words[letter]+'.'));
      const reveal=node('button','Show letter sequence');body.append(reveal);
      reveal.onclick=()=>reveal.replaceWith(node('p',words[letter].toUpperCase().split('').join(' · ')));
    };
  });
  const links={'Courses':'#courses','Sign Dictionary':'#signlang','About Transora':'#how','Our Mission':'#how','Accessibility':'#features','Forum':'studio.html#community','Visual Debugger':'studio.html#studio'};
  document.querySelectorAll('footer a').forEach(link=>{
    const title=link.textContent.trim();
    if(links[title]) {link.href=links[title];return;}
    link.onclick=async e=>{
      e.preventDefault();
      if(['Contact','Instructor Portal','Contribute Signs','Discord'].includes(title))return enquiry(title);
      panel(title);
      if(title==='Certificates'){
        try {const data=await request('studio');body.append(node('p',data.user?data.work.filter(x=>x.done).length+' of '+data.lessons.length+' exercises completed.':'Sign in to see your completion record.'),node('p','Formal certificates are unavailable in this edition.'));}catch(err){body.append(node('p',err.message));}
      }else if(title==='Privacy Policy'){
        body.append(node('p','Accounts, drafts, requests and discussions are stored in the local SQLite database. Posts are visible to other learners on this installation. When AI is enabled, submitted questions and lesson context are sent to the model provider.'));
      }else{
        body.append(node('p',title==='Study Rooms'?'Use the shared discussion space to ask classmates a question or review their code.':'Community reading: start with a learner question, then share a worked example.'));
        const a=node('a','Open community notebook');a.href='studio.html#community';body.append(a);
      }
    };
  });
})();
