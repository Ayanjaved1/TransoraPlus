from bisect import bisect_right
from contextlib import ExitStack
from getpass import getpass
from pathlib import Path, PurePosixPath
from shutil import copyfileobj
from tempfile import TemporaryDirectory
from zipfile import ZipFile
from huggingface_hub import HfFileSystem

IDS = {"1782bea75c7d-1", "1782bea75c7d-2", "ee235596b76f-1", "ee235596b76f-2"}

class Joined:
    def __init__(self, parts):
        self.parts = parts
        self.ends = []
        self.pos = 0
        total = 0
        for part in parts:
            total += part.seek(0, 2)
            self.ends.append(total)

    def tell(self):
        return self.pos

    def seekable(self):
        return True

    def seek(self, offset, whence=0):
        self.pos = max(0, (0, self.pos, self.ends[-1])[whence] + offset)
        return self.pos

    def read(self, size=-1):
        remaining = max(0, self.ends[-1] - self.pos)
        if size >= 0:
            remaining = min(size, remaining)
        chunks = []
        while remaining:
            i = bisect_right(self.ends, self.pos)
            start = self.ends[i-1] if i else 0
            self.parts[i].seek(self.pos - start)
            data = self.parts[i].read(min(remaining, self.ends[i] - self.pos))
            if not data:
                raise IOError("Incomplete archive download")
            chunks.append(data)
            self.pos += len(data)
            remaining -= len(data)
        return b"".join(chunks)

def main():
    fs = HfFileSystem(token=getpass("Hugging Face read token (input hidden): ").strip())
    base = "datasets/Exploration-Lab/iSign/iSign-videos_v1.1_part_"
    target = Path(__file__).resolve().with_name("transora-clips.zip")
    with ExitStack() as stack:
        parts = [stack.enter_context(fs.open(base + suffix, "rb", block_size=2**20)) for suffix in ("aa", "ab")]
        archive = stack.enter_context(ZipFile(Joined(parts)))
        clips = [PurePosixPath(n) for n in archive.namelist() if PurePosixPath(n).suffix.lower() in {".mp4", ".avi", ".mov", ".mkv", ".webm"}]
        matches = [p for p in clips if p.stem in IDS]
        if len(matches) != len(IDS) or {p.stem for p in matches} != IDS:
            raise ValueError(f"Exact unique clips unavailable. Example paths: {clips[:5]}")
        with TemporaryDirectory(dir=target.parent) as folder:
            tmp = Path(folder)/target.name
            with ZipFile(tmp, "w") as output:
                for p in matches:
                    with archive.open(str(p)) as src, output.open(p.name, "w") as dst:
                        copyfileobj(src, dst)
                    print("Extracted", p.name)
            tmp.replace(target)
    print("Saved", target)

if __name__ == "__main__":
    main()
