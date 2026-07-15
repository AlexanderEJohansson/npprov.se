#!/usr/bin/env python3
"""Extract readable body text from Skolverket TEX ZIP (I*.TEX info packages)."""

import importlib.util
import json
import re
import sys
import zipfile
from pathlib import Path

_cnt = importlib.util.spec_from_file_location(
    "extract_tex_cnt", Path(__file__).parent / "extract-tex-cnt.py"
)
_cnt_mod = importlib.util.module_from_spec(_cnt)
assert _cnt.loader
_cnt.loader.exec_module(_cnt_mod)
decode_cnt = _cnt_mod.decode_cnt
fix_swedish = _cnt_mod.fix_swedish
parse_delprov = _cnt_mod.parse_delprov


def decode_tex(data: bytes) -> str:
    return data.decode("latin-1", errors="replace")


def running_text(tex: str) -> str:
    m = re.search(r"(?:L.pande text|Kortkommandon),1,-1\s*(.*)", tex, re.S)
    if not m:
        return ""
    body = m.group(1)
    body = re.sub(r"Kortkommandon i Textview.*", "", body, flags=re.S)
    body = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", body)
    return re.sub(r"\s+", " ", body).strip()


def section_chunks(body: str) -> list[dict]:
    """Split elevblad body into titled chunks (Speaking cards etc.)."""
    if not body:
        return []

    markers = [
        m
        for m in re.finditer(
            r"(?:^|\s)([A-Z][A-Za-z0-9 ,'\-]{3,60}?)\s+(?:Warm-up|Part One|Part Two|Discuss|Tell your)",
            body,
        )
    ]
    if markers:
        out: list[dict] = []
        for i, hit in enumerate(markers):
            title = hit.group(1).strip()
            start = hit.start(1)
            end = markers[i + 1].start(1) if i + 1 < len(markers) else len(body)
            chunk = body[start:end].strip()
            if len(chunk) > 40:
                out.append({"title": fix_swedish(title), "body": chunk[:2000]})
        if out:
            return out

    parts = re.split(r"(?=(?:Warm-up|Part One|Part Two)\b)", body)
    out = []
    for p in parts:
        p = p.strip()
        if len(p) < 50:
            continue
        title = p.split(".", 1)[0][:80].strip()
        out.append({"title": fix_swedish(title), "body": p[:2000]})
    return out[:12]


def uppgifter_from_body(body: str) -> list[dict]:
    chunks = re.split(r"(?=\d+\.\s*Uppgift:)", body)
    out: list[dict] = []
    for chunk in chunks:
        m = re.match(r"(\d+)\.\s*Uppgift:\s*(.+)", chunk, re.S)
        if not m:
            continue
        text = re.sub(r"Bildtexter[^\]]*\]", " ", m.group(2))
        text = re.sub(r"Lnk till bildfil\.[^\]]*\]", " ", text)
        text = re.sub(r"\\[a-zA-Z0-9]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < 25:
            continue
        out.append({"num": m.group(1), "text": fix_swedish(text[:1200])})
    return out


def info_tag_for_code(code: str) -> str:
    return f"I{code[1:]}CB"


def extract_zip(zip_path: str) -> list[dict]:
    packages: list[dict] = []
    with zipfile.ZipFile(zip_path) as z:
        pkg_codes = sorted(
            set(
                m.group(1)
                for n in z.namelist()
                for m in [re.search(r"E(\d{5})CB", n)]
                if m
            )
        )

        for code in pkg_codes:
            info_tag = info_tag_for_code(code)
            cnt_files = [
                n
                for n in z.namelist()
                if info_tag in n and n.endswith(".CNT") and f"{info_tag}1.CNT" in n
            ]
            parsed_cnt = None
            for cnt_name in cnt_files:
                parsed_cnt = parse_delprov(decode_cnt(z.read(cnt_name)))
                if parsed_cnt:
                    break
            if not parsed_cnt:
                continue

            tex_texts: list[str] = []
            for n in z.namelist():
                if info_tag in n and re.search(rf"{info_tag}\d+\.TEX$", n):
                    tex_texts.append(decode_tex(z.read(n)))

            body = " ".join(running_text(t) for t in tex_texts)
            sections = section_chunks(body)
            uppgifter = uppgifter_from_body(body)

            q_map = {q["code"]: q for q in parsed_cnt["questions"]}
            enriched: list[dict] = []
            for q in parsed_cnt["questions"]:
                body_text = ""
                num = re.sub(r"^[AB]", "", q["code"])
                for u in uppgifter:
                    if u["num"] == num:
                        body_text = u["text"]
                        break
                if not body_text and sections:
                    idx = int(num) - 1 if num.isdigit() else -1
                    if 0 <= idx < len(sections):
                        body_text = sections[idx]["body"]
                enriched.append(
                    {
                        "code": q["code"],
                        "title": q["title"],
                        "body": body_text,
                    }
                )

            packages.append(
                {
                    "code": code,
                    "beteckning": parsed_cnt["beteckning"],
                    "questions": enriched,
                    "uppgift_count": len(uppgifter),
                }
            )
    return packages


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: extract-tex-body.py <zip>", file=sys.stderr)
        sys.exit(1)
    result = extract_zip(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()