// Browser ES module. Import {Tutor} from './sign-tutor.mjs'.
// Each session selects one language. Supply recordings of entire explanations.
export const courses = {
 Python: [
 ["Variables","Assignment gives a name to a value.","score = 2\nprint(score + 3)","What number appears?","5"],
 ["Loops","A for loop visits each item. range(3) supplies 0, 1 and 2.","total = 0\nfor i in range(3):\n    total += i\nprint(total)","What is the final total?","3"],
 ["Generators","yield pauses a function and preserves its local state between requests.","def ids():\n    yield 7\n    yield 9\ng = ids()\nnext(g)\nprint(next(g))","What does the second call return?","9"]],
 Java: [
 ["Variables","An int stores a whole number. These statements go inside main.","int n = 4;\nSystem.out.println(n * 2);","What number appears?","8"],
 ["Arrays","Array indexes start at zero.","int[] a = {4, 8, 12};\nSystem.out.println(a[1]);","Which value appears?","8"],
 ["Streams","A stream can filter a sequence before reducing it to a count.","long n = java.util.stream.Stream.of(2, 3, 5)\n    .filter(x -> x > 2).count();","What is n?","2"]],
 HTML: [
 ["Headings","Use h1 for the main heading.","<h1>My first page</h1>","Which tag names the main heading?","h1"],
 ["Labels","A label's for value matches the input id.","<label for='city'>City</label>\n<input id='city'>","What value connects these elements?","city"],
 ["Responsive images","The browser checks source elements in order before using the fallback image.","<picture>\n  <source media='(min-width: 800px)' srcset='wide.jpg'>\n  <img src='small.jpg' alt='Campus'>\n</picture>","Which file appears at a viewport width of 600px?","small.jpg"]],
 CSS: [
 ["Selectors","A class selector begins with a dot.",".note { color: blue; }","Which color will text in the note class use?","blue"],
 ["Grid","repeat creates multiple tracks with the same sizing rule.",".cards { display: grid; grid-template-columns: repeat(3, 1fr); }","How many columns are defined?","3"],
 ["Specificity","Within the same cascade layer, an ID selector outweighs a class selector for ordinary declarations.",".card { color: red; }\n#featured { color: green; }","Which color applies to a card with id featured?","green"]]
};
const commands = ['next','back','repeat','quiz'];
const distance = (a,b) => a.reduce((s,x,i)=>s+(x-b[i])**2,0)/a.length;
export class Tutor {
 constructor(course,language,clips={}) {
  if(!Object.hasOwn(courses,course)||!['ISL','ASL'].includes(language)) throw Error('Select a supported course and sign language');
  Object.assign(this,{course,language,clips,index:0,samples:{}});
 }
 lesson(){
  const [title,explanation,code,question]=courses[this.course][this.index];
  const key=[this.language,this.course,this.index].join('/');
  return {title,explanation,code,question,video:this.clips[key]??null};
 }
 answer(text){ return text.trim().toLowerCase()===courses[this.course][this.index][4]; }
 act(command){
  if(!commands.includes(command)) throw Error('Unknown command');
  if(command==='next') this.index=Math.min(this.index+1,courses[this.course].length-1);
  if(command==='back') this.index=Math.max(0,this.index-1);
  return command==='quiz'?{question:this.lesson().question}:this.lesson();
 }
 train(label,sequence){
  if(!commands.includes(label)||!valid(sequence)) throw Error('Invalid training sample');
  (this.samples[label]??=[]).push([...sequence]);
 }
 recognize(sequence){
  if(!valid(sequence)) throw Error('Invalid recording');
  const scores=Object.entries(this.samples).filter(([,v])=>v.length>=2).map(([label,v])=>({
   label,score:Math.min(...v.map(x=>distance(x,sequence))),radius:Math.max(...v.slice(1).map(x=>distance(x,v[0])))
  })).sort((a,b)=>a.score-b.score);
  const [a,b]=scores;
  return b && a.score<=Math.max(0.0001,a.radius*1.5) && a.score<0.75*b.score?a.label:null;
 }
}
function valid(x){return x?.length===768 && Array.from(x).every(Number.isFinite)}
// Start the same 1.2-second window for enrollment and prediction.
// Pass a playing HTMLVideoElement backed by the learner's webcam.
export async function capture(video){
 if(video.readyState<2) throw Error('Camera video is not ready');
 const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
 const ctx=canvas.getContext('2d',{willReadFrequently:true}), out=[];
 let previous;
 for(let i=0;i<13;i++){
  ctx.drawImage(video,0,0,8,8);
  const pixels=ctx.getImageData(0,0,8,8).data;
  const frame=Array.from({length:64},(_,j)=>(pixels[4*j]+pixels[4*j+1]+pixels[4*j+2])/765);
  if(previous) out.push(...frame.map((v,j)=>v-previous[j]));
  previous=frame;
  if(i<12) await new Promise(resolve=>setTimeout(resolve,100));
 }
 return out;
}
