"""Crop in-run pet GIFs to the playfield and save short looping webps."""
from pathlib import Path
from PIL import Image

SRC = Path(r"C:\Users\Micheal\insomnus-design\assets\lab\pets")
OUT = Path(__file__).resolve().parents[1] / "assets" / "pets"
CROP = (120, 86, 1080, 632)
OUT_W = 720
START = 24
COUNT = 48
STEP = 2
DURATION = 80

JOBS = [
    ("gloop.gif", "run-gloop.webp", "still-gloop.png"),
    ("demon-dog.gif", "run-demon-dog.webp", "still-demon-dog.png"),
    ("heal-bot.gif", "run-heal-bot.webp", "still-heal-bot.png"),
]


def grab(src: Path):
    im = Image.open(src)
    frames = []
    n = getattr(im, "n_frames", 1)
    want = set(range(START, min(n, START + COUNT * STEP), STEP))
    for i in range(n):
        im.seek(i)
        if i not in want:
            continue
        fr = im.convert("RGB").crop(CROP)
        ratio = OUT_W / fr.width
        size = (OUT_W, max(1, int(fr.height * ratio)))
        fr = fr.resize(size, Image.NEAREST)
        frames.append(fr)
        if len(frames) >= COUNT:
            break
    return frames


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for src_name, webp_name, still_name in JOBS:
        src = SRC / src_name
        print("reading", src_name)
        frames = grab(src)
        if not frames:
            raise SystemExit(f"no frames from {src_name}")
        still = frames[len(frames) // 2]
        still.save(OUT / still_name, "PNG")
        frames[0].save(
            OUT / webp_name,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=DURATION,
            loop=0,
            quality=72,
            method=4,
        )
        size = (OUT / webp_name).stat().st_size
        print("  ->", webp_name, len(frames), "frames", round(size / 1024), "KB")


if __name__ == "__main__":
    main()
