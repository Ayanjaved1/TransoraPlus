import json, os, tempfile, urllib.request
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse
import torch
from model import Translator
from motion import extract
from train import tokens

app = FastAPI()
models = {}
@app.get("/")
def home():
    return FileResponse(Path(__file__).with_name("index.html"))

def load(language):
    if language not in ("ISL","ASL"):
        raise HTTPException(400,"Choose ISL or ASL")
    if language not in models:
        p = Path(language+".pt")
        if not p.exists():
            raise HTTPException(503,"No trained checkpoint for "+language)
        data = torch.load(p, map_location="cpu", weights_only=True)
        net = Translator(len(data["vocab"]))
        net.load_state_dict(data["weights"])
        models[language] = (net.eval(), data["vocab"])
    return models[language]

@app.post("/ask/{language}")
def ask(language: str, video: UploadFile, course: str="Python"):
    net, vocab = load(language)
    if course not in ("Python","Java","HTML","CSS"):
        raise HTTPException(400,"Unknown course")
    data = video.file.read(16*1024*1024+1)
    if len(data)>16*1024*1024:
        raise HTTPException(413,"Clip too large")
    with tempfile.TemporaryDirectory() as folder:
        p = Path(folder)/"question.webm"
        p.write_bytes(data)
        try:
            x = torch.from_numpy(extract(p))[None]
        except ValueError as e:
            raise HTTPException(422,str(e))
    with torch.inference_mode():
        ids = net.read(x).argmax(-1)[0].tolist()
    words = {v:k for k,v in vocab.items()}
    if not ids or ids[-1]!=2 or any(i<3 for i in ids[:-1]) or len(ids)<2:
        raise HTTPException(422,"Please sign again")
    question = " ".join(words[i] for i in ids[:-1])
    payload = dict(model=os.getenv("TUTOR_MODEL","qwen2.5-coder:3b"),stream=False,messages=[
        dict(role="system",content=f"Teach {course}. Answer the question in one short, concrete sentence. Ask for clarification if unclear."),
        dict(role="user",content=question)])
    req = urllib.request.Request("http://127.0.0.1:11434/api/chat",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=90) as response:
            answer = json.load(response)["message"]["content"]
    except (OSError, ValueError, KeyError) as e:
        raise HTTPException(503,"Local coding tutor unavailable") from e
    terms = tokens(answer)
    if not terms or any(t not in vocab for t in terms):
        raise HTTPException(422,"Answer exceeds the trained signing vocabulary")
    with torch.inference_mode():
        frames,_ = net.sign(torch.tensor([[vocab[t] for t in terms]+[2]]))
    return {"frames":frames[0].reshape(-1,65,3).tolist(),"fps":12}
