#!/usr/bin/env python3
"""Extract text from Läraranvisning doc/docx inside a Skolverket ZIP."""

import io
import json
import re
import subprocess
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


def decode_name(raw: str) -> str:
    try:
        return raw.encode("cp437").decode("utf-8")
    except Exception:
        return raw


def docx_text(data: bytes) -> str:
    dz = zipfile.ZipFile(io.BytesIO(data))
    xml = dz.read("word/document.xml")
    root = ET.fromstring(xml)
    parts: list[str] = []
    for t in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def doc_text(data: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".doc", delete=False) as f:
        f.write(data)
        path = f.name
    try:
        return subprocess.check_output(
            ["textutil", "-convert", "txt", "-stdout", path],
            text=True,
            errors="replace",
        )
    finally:
        Path(path).unlink(missing_ok=True)


def extract_text(name: str, data: bytes) -> str:
    if name.lower().endswith(".docx"):
        return docx_text(data)
    if name.lower().endswith(".doc"):
        return doc_text(data)
    return ""


def main() -> None:
    if len(sys.argv) < 3:
        print("usage: extract-zip-docx.py <zip> <code-prefix>", file=sys.stderr)
        sys.exit(1)

    zpath = Path(sys.argv[1])
    code = sys.argv[2]
    prefer = sys.argv[3] if len(sys.argv) > 3 else "textview"

    with zipfile.ZipFile(zpath, "r") as z:
        candidates = []
        for info in z.infolist():
            name = decode_name(info.filename)
            base = Path(name).name
            if code not in base:
                continue
            if not re.search(r"larar.*anvis", base, re.I):
                continue
            if re.search(r"punktskrift|e-bok", base, re.I):
                continue
            candidates.append((name, z.read(info)))

    if not candidates:
        print(json.dumps({"text": "", "file": ""}))
        return

    def score(item: tuple[str, bytes]) -> int:
        n = item[0].lower()
        s = 0
        if prefer in n:
            s += 10
        if n.endswith(".docx"):
            s += 2
        return s

    best_name, best_data = max(candidates, key=score)
    text = extract_text(best_name, best_data)
    print(json.dumps({"text": text, "file": Path(best_name).name}, ensure_ascii=False))


if __name__ == "__main__":
    main()