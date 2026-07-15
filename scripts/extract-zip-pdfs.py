#!/usr/bin/env python3
"""Extract matching PDFs from a ZIP to an output directory (UTF-8 paths)."""

import json
import sys
import zipfile
from pathlib import Path


def decode_name(raw: str) -> str:
    try:
        return raw.encode("cp437").decode("utf-8")
    except Exception:
        return raw


def should_include(name: str, patterns: list[str], exclude: list[str]) -> bool:
    lower = name.lower()
    if "__macosx" in lower or lower.endswith("/"):
        return False
    if not lower.endswith(".pdf"):
        return False
    # Match exclude/patterns on filename only — folder names like "engelska" must not block elevkort PDFs
    base = Path(name).name.lower()
    for ex in exclude:
        if ex.lower() in base:
            return False
    if not patterns:
        return True
    return any(p.lower() in base for p in patterns)


def main() -> None:
    if len(sys.argv) < 4:
        print("usage: extract-zip-pdfs.py <zip> <outdir> <patterns-json>", file=sys.stderr)
        sys.exit(1)

    zpath = Path(sys.argv[1])
    outdir = Path(sys.argv[2])
    patterns = json.loads(sys.argv[3])
    exclude = [
        "eng version",
        "engelsk",
        "blanketter",
        "lasanvisning",
        "laranvisning",
        "rarinformation",
        "kort till",
        "kort till del",
    ]

    outdir.mkdir(parents=True, exist_ok=True)
    extracted = []

    with zipfile.ZipFile(zpath, "r") as z:
        for info in z.infolist():
            name = decode_name(info.filename)
            if not should_include(name, patterns, exclude):
                continue
            safe = Path(name).name
            target = outdir / safe
            target.write_bytes(z.read(info))
            extracted.append(safe)

    print(json.dumps(extracted, ensure_ascii=False))


if __name__ == "__main__":
    main()