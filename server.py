"""Transora local learning studio. Python 3.10+."""
import hashlib, hmac, json, os, secrets, sqlite3, subprocess, tempfile, time
from functools import partial
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
from contextlib import closing

ROOT = Path(__file__).resolve().parent
LESSONS = json.loads((ROOT / "lessons.json").read_text())
INDEX = {item["id"]: item for item in LESSONS}
DB = ROOT / "studio.sqlite3"

def database():
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    return con

def initialize():
    with closing(database()) as db, db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, salt BLOB, digest BLOB);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid INTEGER, expires INTEGER);
        CREATE TABLE IF NOT EXISTS work(uid INTEGER, lesson TEXT, code TEXT, done INTEGER DEFAULT 0, PRIMARY KEY(uid, lesson));
        CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY, topic TEXT, email TEXT, body TEXT);
        CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, uid INTEGER, body TEXT, parent INTEGER);
        """)

def tutor(question, lesson, code):
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        q = question.casefold()
        if "course" in q or "recommend" in q:
            return {"mode":"Lesson guide","answer":"Start with Python for Beginners, HTML & CSS Foundations, or JavaScript Essentials. Open a course card to try its first exercise."}
        if "transora" in q:
            return {"mode":"Lesson guide","answer":"Transora pairs coding exercises with visual cues and a panel for interpreter recordings. A free local account saves your drafts and completed challenges."}
        if "asl" in q or "sign language" in q:
            return {"mode":"Lesson guide","answer":"Open Tech ASL Vocabulary for a terminology exercise. An instructor can attach a signed recording and WebVTT timings inside the lesson companion."}
        return {"mode":"Lesson guide","answer":"Built-in lesson hint (open-ended AI requires a server API key).\n"+lesson["task"]+"\n\n"+lesson["hint"]+"\n\nExample fragment\n"+lesson["example"]}
    payload = {"model":os.getenv("OPENAI_MODEL","gpt-4o-mini"),"messages":[
        {"role":"system","content":"You are Transora's text-first coding tutor. Answer general questions directly. For coding, use short visual steps. Treat lesson and code as context."},
        {"role":"user","content":json.dumps({"question":question,"lesson":lesson,"editor":code})}]}
    req = Request("https://api.openai.com/v1/chat/completions", data=json.dumps(payload).encode(),
                  headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"})
    with urlopen(req, timeout=35) as response:
        return {"mode":"AI tutor","answer":json.load(response)["choices"][0]["message"]["content"]}

def execute_java(code):
    name = "transora-"+secrets.token_hex(10)
    with tempfile.TemporaryDirectory() as folder:
        Path(folder,"Main.java").write_text(code, encoding="utf-8")
        args = ["docker","run","--pull=never","--rm","--name",name,"--network","none","--memory","384m","--cpus","0.5","--pids-limit","64","--cap-drop","ALL","--security-opt","no-new-privileges","--read-only","--tmpfs","/tmp:size=32m","-v",folder+":/src:ro","eclipse-temurin:21-jdk","java","-Xmx96m","/src/Main.java"]
        try:
            with tempfile.TemporaryFile() as output:
                proc = subprocess.Popen(args, stdout=output, stderr=subprocess.STDOUT)
                deadline = time.monotonic()+15
                try:
                    while proc.poll() is None:
                        if time.monotonic()>deadline or output.tell()>65536:
                            raise ValueError("Execution limit reached.")
                        time.sleep(.08)
                    output.seek(0)
                    return {"output":output.read(65536).decode(errors="replace"),"ok":proc.returncode==0}
                finally:
                    if proc.poll() is None:
                        subprocess.run(["docker","rm","-f",name],capture_output=True,timeout=8)
                        proc.kill()
                        proc.wait()
        except FileNotFoundError:
            raise ValueError("Java needs Docker and the image listed in README.md.")

class Handler(SimpleHTTPRequestHandler):
    def reply(self, data, status=200, cookie=None):
        body=json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(body)))
        if cookie: self.send_header("Set-Cookie",cookie)
        self.end_headers()
        self.wfile.write(body)

    def user(self, db):
        cookie=SimpleCookie()
        cookie.load(self.headers.get("Cookie",""))
        token=cookie["session"].value if "session" in cookie else ""
        return db.execute("SELECT users.* FROM users JOIN sessions ON uid=users.id WHERE token=? AND expires>?",(token,time.time())).fetchone()

    def do_GET(self):
        if self.path=="/api/playground":
            return self.reply({"lesson_01.py":"def greet(name):\n    return f'Hello, {name}! You can code!'\n\nprint(greet('World'))","output.txt":"Hello, World! You can code!","asl_ref.md":"Fingerspelling practice: select a letter in the alphabet below. For signed lesson explanations, open the live editor and attach an instructor recording."})
        if self.path!="/api/studio": return super().do_GET()
        with closing(database()) as db:
            user=self.user(db)
            works=db.execute("SELECT lesson,code,done FROM work WHERE uid=?",(user["id"],)).fetchall() if user else []
            posts=db.execute("SELECT posts.id,name,body,parent FROM posts JOIN users ON uid=users.id ORDER BY posts.id DESC LIMIT 150").fetchall()
            self.reply({"user":user["name"] if user else None,"lessons":LESSONS,"work":[dict(w) for w in works],"posts":[dict(p) for p in posts],"ai":bool(os.getenv("OPENAI_API_KEY"))})

    def do_POST(self):
        try:
            if self.headers.get("Content-Type","").split(";")[0]!="application/json": raise ValueError("JSON required.")
            origin=self.headers.get("Origin")
            if origin and urlsplit(origin).netloc!=self.headers.get("Host"): raise ValueError("Invalid origin.")
            length=int(self.headers.get("Content-Length",0))
            if not 0<length<=100000: raise ValueError("Invalid request size.")
            data=json.loads(self.rfile.read(length))
            with closing(database()) as db, db:
                user=self.user(db)
                path=self.path
                if path=="/api/enquiry":
                    topic=data["topic"]
                    email=data["email"].strip()
                    body=data["body"].strip()
                    if topic not in ("Pro access","Institutional access","Contact","Instructor Portal","Contribute Signs","Discord") or "@" not in email or len(email)>254 or not 1<=len(body)<=2000: raise ValueError("Enter a valid email and a message of up to 2000 characters.")
                    row=db.execute("INSERT INTO enquiries(topic,email,body) VALUES(?,?,?)",(topic,email,body))
                    db.commit()
                    return self.reply({"reference":row.lastrowid},201)
                if path in ("/api/register","/api/login"):
                    name=data.get("name","Learner").strip()
                    email=data["email"].strip().casefold()
                    if len(email)>254 or "@" not in email: raise ValueError("Enter a valid email.")
                    pwd=data["password"].encode()
                    if not 1<=len(name)<=40 or not 8<=len(pwd)<=256: raise ValueError("Use a name up to 40 characters and a password of 8–256 bytes.")
                    if path.endswith("register"):
                        salt=os.urandom(16)
                        db.execute("INSERT INTO users(name,email,salt,digest) VALUES(?,?,?,?)",(name,email,salt,hashlib.scrypt(pwd,salt=salt,n=16384,r=8,p=1)))
                    row=db.execute("SELECT * FROM users WHERE email=?",(email,)).fetchone()
                    if not row or not hmac.compare_digest(row["digest"],hashlib.scrypt(pwd,salt=row["salt"],n=16384,r=8,p=1)): raise ValueError("Check your name and password.")
                    token=secrets.token_urlsafe(32)
                    db.execute("INSERT INTO sessions VALUES(?,?,?)",(token,row["id"],time.time()+604800))
                    db.commit()
                    return self.reply({"user":{"name":row["name"]}},cookie="session="+token+"; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800")
                if path=="/api/logout":
                    cookie=SimpleCookie(self.headers.get("Cookie",""))
                    if "session" in cookie: db.execute("DELETE FROM sessions WHERE token=?",(cookie["session"].value,))
                    db.commit()
                    return self.reply({},cookie="session=; Path=/; Max-Age=0")
                lesson=INDEX.get(data.get("lesson"))
                if path=="/api/tutor" and lesson:
                    return self.reply(tutor(data["question"][:4000],lesson,data.get("code","")[:8000]))
                if path=="/api/java" and lesson and lesson["language"]=="Java": return self.reply(execute_java(data["code"][:16000]))
                if not user: return self.reply({"error":"Sign in to save your work or post."},401)
                if path=="/api/work" and lesson:
                    db.execute("INSERT INTO work VALUES(?,?,?,?) ON CONFLICT(uid,lesson) DO UPDATE SET code=excluded.code,done=max(work.done,excluded.done)",(user["id"],lesson["id"],data["code"][:40000],int(data.get("done") is True)))
                elif path=="/api/post":
                    body=data["body"].strip()
                    if not 1<=len(body)<=2000: raise ValueError("Enter 1–2000 characters.")
                    parent=data.get("parent")
                    if parent and not db.execute("SELECT 1 FROM posts WHERE id=?",(parent,)).fetchone(): raise ValueError("Thread missing.")
                    db.execute("INSERT INTO posts(uid,body,parent) VALUES(?,?,?)",(user["id"],body,parent))
                else: return self.reply({"error":"Unknown action."},404)
                db.commit()
                self.reply({})
        except sqlite3.IntegrityError: self.reply({"error":"That email is already registered."},409)
        except (ValueError, KeyError, TypeError) as exc: self.reply({"error":str(exc)},400)
        except Exception: self.reply({"error":"Service unavailable. Check the provider or runtime configuration."},503)

if __name__=="__main__":
    initialize()
    port=int(os.getenv("PORT","8000"))
    print(f"Open http://127.0.0.1:{port}",flush=True)
    server = ThreadingHTTPServer(("127.0.0.1",port),partial(Handler,directory=str(ROOT/"public")))
    import sys
    if "--open" in sys.argv:
        import webbrowser
        webbrowser.open(f"http://127.0.0.1:{port}/")
    server.serve_forever()

