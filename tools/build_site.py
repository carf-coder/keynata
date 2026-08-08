#!/usr/bin/env python3
"""
Keynata public build (SPEC_PUBLISH section 1).

Generates dist/ for GitHub Pages from the repository, using only the Python
standard library. The repository keeps human-readable pretty-printed song JSON;
only the delivered copy is minified.

Included: index.html / app.js / i18n.js / style.css / songs/*.json (minified) / samples/
Excluded: songs_private/ / tools/ (incl. source_midi) / venv/ / __pycache__/ /
          .claude/ / .git/ / README*.md / dist/ itself

Five validation gates run against the built tree. If any gate fails the script
exits non-zero and leaves no dist/ directory behind, so a failing build can
never be deployed.

Usage: python3 tools/build_site.py [--out dist]
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

COPY_FILES = ["index.html", "app.js", "i18n.js", "style.css"]
COPY_DIRS = ["samples"]
SONGS_DIR = "songs"

PRIVATE_INDEX = ROOT / "songs_private" / "index.json"
PRIVATE_DIR = ROOT / "songs_private"

PRIVATE_MARKERS = ["songs_private", "source_midi_private"]

# The game itself probes songs_private/index.json at runtime so that the owner's
# local copy can list private songs; on the public site the fetch simply 404s.
# These two lines of app.js are therefore the only permitted occurrences of the
# marker strings in the build output. Anything else is treated as a leak.
ALLOWED_PRIVATE_LINES = {
    "app.js": {
        "// SPEC §23: 私的利用曲(songs_private/、配布対象外)。"
        "索引が無ければ空扱い。",
        'const PRIVATE_SONG_INDEX = "songs_private/index.json";',
    }
}

# Deliberately narrow: arrows (U+2190-U+21FF) and box drawing are text, not emoji.
EMOJI_RE = re.compile(
    "["
    "\U0001f000-\U0001faff"  # pictographs, emoticons, transport, symbols, flags
    "\u2600-\u27bf"          # misc symbols and dingbats
    "\u2b00-\u2bff"          # misc symbols and arrows used by emoji
    "\ufe0f"                 # variation selector 16
    "\u20e3"                 # combining enclosing keycap
    "]"
)

LICENSE_FORBIDDEN = [
    re.compile(r"CC[\s\-_]?BY", re.IGNORECASE),
    re.compile(r"\bSA\b"),
    re.compile(r"\bNC\b"),
    re.compile(r"NonCommercial", re.IGNORECASE),
    re.compile(r"ShareAlike", re.IGNORECASE),
]
LICENSE_REQUIRED = re.compile(
    r"(public\s*domain|CC0|PD|パブリックドメイン)",
    re.IGNORECASE,
)

BINARY_SUFFIXES = {".mp3", ".ogg", ".wav", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"}


class BuildError(Exception):
    pass


def log(msg):
    print(msg, flush=True)


def iter_files(root):
    for path in sorted(root.rglob("*")):
        if path.is_file():
            yield path


def read_text(path):
    """Return decoded text, or None for binary assets."""
    if path.suffix.lower() in BINARY_SUFFIXES:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None


# ---------------------------------------------------------------- build steps


def copy_static(out):
    for name in COPY_FILES:
        src = ROOT / name
        if not src.exists():
            raise BuildError(f"required source file is missing: {name}")
        shutil.copy2(src, out / name)
    for name in COPY_DIRS:
        src = ROOT / name
        if not src.is_dir():
            raise BuildError(f"required source directory is missing: {name}/")
        shutil.copytree(src, out / name)


def minify_songs(out):
    """Minify songs/*.json and verify each minified copy re-parses to the same value."""
    src_dir = ROOT / SONGS_DIR
    dst_dir = out / SONGS_DIR
    dst_dir.mkdir(parents=True, exist_ok=True)

    total_before = 0
    total_after = 0
    count = 0
    for src in sorted(src_dir.glob("*.json")):
        raw = src.read_text(encoding="utf-8")
        data = json.loads(raw)
        minified = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        if json.loads(minified) != data:
            raise BuildError(f"minified JSON does not round-trip: {src.name}")
        dst = dst_dir / src.name
        dst.write_text(minified, encoding="utf-8")
        # Re-read from disk so the check covers what is actually delivered.
        if json.loads(dst.read_text(encoding="utf-8")) != data:
            raise BuildError(f"written JSON does not round-trip: {src.name}")
        total_before += len(raw.encode("utf-8"))
        total_after += len(minified.encode("utf-8"))
        count += 1

    if count == 0:
        raise BuildError("no song JSON found in songs/")
    return count, total_before, total_after


# ---------------------------------------------------------------- gate 1


def collect_private_identifiers():
    ids = set()
    files = set()
    if PRIVATE_INDEX.exists():
        try:
            entries = json.loads(PRIVATE_INDEX.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise BuildError(f"songs_private/index.json is not valid JSON: {exc}")
        if not isinstance(entries, list):
            raise BuildError("songs_private/index.json must contain a list")
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if entry.get("id"):
                ids.add(str(entry["id"]))
            if entry.get("file"):
                files.add(Path(str(entry["file"])).name)
    if PRIVATE_DIR.is_dir():
        for path in PRIVATE_DIR.glob("*.json"):
            if path.name == "index.json":
                continue
            ids.add(path.stem)
            files.add(path.name)
    return ids, files


def gate_private(out, failures):
    ids, files = collect_private_identifiers()
    log(f"  private song identifiers under watch: {len(ids)}")

    for path in iter_files(out):
        rel = path.relative_to(out).as_posix()

        for marker in PRIVATE_MARKERS:
            if marker in rel:
                failures.append(f"gate1: private marker '{marker}' in output path {rel}")

        if path.name in files or path.stem in ids:
            failures.append(f"gate1: private song file leaked into output: {rel}")

        text = read_text(path)
        if text is None:
            continue

        allowed = ALLOWED_PRIVATE_LINES.get(rel, set())
        for lineno, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            for marker in PRIVATE_MARKERS:
                if marker in line and stripped not in allowed:
                    failures.append(
                        f"gate1: private marker '{marker}' in {rel}:{lineno}: {stripped[:80]}"
                    )
        for song_id in ids:
            if song_id and song_id in text:
                failures.append(f"gate1: private song id '{song_id}' referenced in {rel}")


# ---------------------------------------------------------------- gate 2


def gate_license(out, failures):
    checked = 0
    for path in sorted((out / SONGS_DIR).glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        lic = data.get("license")
        if not lic:
            failures.append(f"gate2: {path.name} has no license field")
            continue
        checked += 1
        for pattern in LICENSE_FORBIDDEN:
            if pattern.search(lic):
                failures.append(
                    f"gate2: {path.name} license is not PD/CC0 only: {lic!r}"
                )
                break
        else:
            if not LICENSE_REQUIRED.search(lic):
                failures.append(
                    f"gate2: {path.name} license does not state public domain or CC0: {lic!r}"
                )
    log(f"  song licenses checked: {checked}")


# ---------------------------------------------------------------- gate 3


def gate_emoji(out, failures):
    for path in iter_files(out):
        text = read_text(path)
        if text is None:
            continue
        rel = path.relative_to(out).as_posix()
        for lineno, line in enumerate(text.splitlines(), 1):
            found = EMOJI_RE.findall(line)
            if found:
                codes = ", ".join(sorted({f"U+{ord(c):04X}" for c in found}))
                failures.append(f"gate3: emoji in {rel}:{lineno} ({codes})")
                break


# ---------------------------------------------------------------- gate 4

HTML_REF_RE = re.compile(r'(?:src|href)\s*=\s*"([^"]+)"')
SONG_FILE_RE = re.compile(r'file\s*:\s*"([^"]+)"')


def gate_references(out, failures):
    html = (out / "index.html").read_text(encoding="utf-8")
    local_refs = []
    for ref in HTML_REF_RE.findall(html):
        if ref.startswith(("http://", "https://", "//", "data:", "#", "mailto:")):
            continue
        local_refs.append(ref.split("?")[0].split("#")[0])
    if not local_refs:
        failures.append("gate4: index.html references no local assets (parser broke?)")
    for ref in local_refs:
        if not (out / ref).exists():
            failures.append(f"gate4: index.html references missing asset {ref}")
    log(f"  local assets referenced by index.html: {len(local_refs)}")

    app = (out / "app.js").read_text(encoding="utf-8")
    start = app.find("const SONG_LIST")
    if start < 0:
        failures.append("gate4: SONG_LIST not found in app.js")
        return
    end_match = re.compile(r"^\]", re.MULTILINE).search(app, start)
    end = end_match.start() if end_match else -1
    if end < 0:
        failures.append("gate4: end of SONG_LIST not found in app.js")
        return
    song_files = SONG_FILE_RE.findall(app[start:end])
    if not song_files:
        failures.append("gate4: SONG_LIST contains no song files (parser broke?)")
    for ref in song_files:
        if not (out / ref).exists():
            failures.append(f"gate4: SONG_LIST entry points at missing file {ref}")
    log(f"  songs referenced by SONG_LIST: {len(song_files)}")

    samples = list((out / "samples").glob("*.mp3"))
    if not samples:
        failures.append("gate4: no piano samples in dist/samples/")
    log(f"  piano samples: {len(samples)}")


# ---------------------------------------------------------------- main


def dir_size(path):
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file())


def human(n):
    for unit in ("B", "KB", "MB"):
        if n < 1024 or unit == "MB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024.0


def main():
    parser = argparse.ArgumentParser(description="Build the Keynata public site into dist/.")
    parser.add_argument("--out", default="dist", help="output directory (default: dist)")
    args = parser.parse_args()

    out = (ROOT / args.out).resolve()
    tmp = out.parent / (out.name + ".tmp")

    if out == ROOT:
        raise SystemExit("refusing to build into the repository root")

    for path in (out, tmp):
        if path.exists():
            shutil.rmtree(path)
    tmp.mkdir(parents=True)

    failures = []
    try:
        log("Keynata public build")
        log(f"  source: {ROOT}")
        copy_static(tmp)
        count, before, after = minify_songs(tmp)

        log("running validation gates")
        gate_private(tmp, failures)
        gate_license(tmp, failures)
        gate_emoji(tmp, failures)
        gate_references(tmp, failures)
    except BuildError as exc:
        failures.append(f"build error: {exc}")
        count = before = after = 0

    if failures:
        shutil.rmtree(tmp, ignore_errors=True)
        if out.exists():
            shutil.rmtree(out, ignore_errors=True)
        log("")
        log(f"BUILD FAILED ({len(failures)} problem(s)); no dist/ was produced")
        for item in failures:
            log(f"  - {item}")
        return 1

    tmp.rename(out)

    total = dir_size(out)
    reduction = (1 - after / before) * 100 if before else 0.0
    log("")
    log("BUILD OK")
    log(f"  output          : {out}")
    log(f"  songs           : {count}")
    log(f"  song JSON before: {human(before)}")
    log(f"  song JSON after : {human(after)}")
    log(f"  reduction       : {reduction:.1f}%")
    log(f"  dist total size : {human(total)}")
    log("  gates passed    : private-song exclusion, license, emoji-free, references, summary")
    return 0


if __name__ == "__main__":
    sys.exit(main())
