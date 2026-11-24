import argparse, csv, hashlib, json, os, re
from pathlib import Path
import numpy as np
import torch
from torch.nn import functional as F
from model import Translator
from motion import extract

def tokens(text):
    return re.findall(r"[\w]+|[^\w\s]", text.lower())

def run(args):
    root = Path(args.manifest).resolve().parent
    with open(args.manifest, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if r["language"] == args.language]
    train = [r for r in rows if r["split"] == "train"]
    val = [r for r in rows if r["split"] == "validation"]
    if not train or not val:
        raise ValueError("Supply train and validation rows")
    assigned = {}
    for row in rows:
        group = row.get(args.split_by, "").strip()
        if not group or assigned.setdefault(group, row["split"]) != row["split"]:
            raise ValueError(f"Each {args.split_by} needs one consistent split")
    vocab = dict(zip(["<unk>", "<start>", "<end>"], range(3)))
    for r in train:
        for word in tokens(r["text"]):
            vocab.setdefault(word, len(vocab))
    torch.manual_seed(11)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = Translator(len(vocab)).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.0005)
    cache = root / ".motion-v1"
    cache.mkdir(exist_ok=True)
    def loss(row):
        path = (root / row["video"]).resolve()
        key = hashlib.sha256(f"{path}:{path.stat().st_mtime_ns}".encode()).hexdigest()
        dest = cache / (key + ".npy")
        if not dest.exists():
            np.save(dest, extract(path))
        pose = torch.from_numpy(np.load(dest)).unsqueeze(0).to(device)
        words = torch.tensor([[vocab.get(w, 0) for w in tokens(row["text"])] + [2]], device=device)
        logits = model.read(pose, words)
        frames, stops = model.sign(words, pose)
        end = torch.zeros_like(stops)
        end[:, -1] = 1
        duration = F.binary_cross_entropy_with_logits(stops, end, pos_weight=stops.new_tensor([max(1, stops.size(1)-1)]))
        return F.cross_entropy(logits.flatten(0,1), words.flatten()) + F.smooth_l1_loss(frames, pose) + duration
    best = float("inf")
    for epoch in range(args.epochs):
        model.train()
        for idx in torch.randperm(len(train)).tolist():
            optimizer.zero_grad()
            loss(train[idx]).backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1)
            optimizer.step()
        model.eval()
        with torch.no_grad():
            score = sum(loss(row).item() for row in val) / len(val)
        print(f"epoch={epoch+1} validation_loss={score:.4f}", flush=True)
        if score < best:
            best = score
            dest = args.language + ".pt"
            torch.save(dict(vocab=vocab, weights=model.state_dict(), language=args.language), dest+".tmp")
            os.replace(dest+".tmp", dest)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("manifest")
    p.add_argument("language", choices=["ASL","ISL"])
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--split-by", choices=["signer", "source_video_id"], default="signer")
    run(p.parse_args())
