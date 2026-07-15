#!/usr/bin/env python3
"""Extract delprov + uppgiftstitlar from Skolverket TEX ZIP (I*.CNT innehållsförteckning)."""

import json
import re
import sys
import zipfile
from pathlib import Path


def decode_cnt(data: bytes) -> str:
    idx = data.find(b"CNT;")
    chunk = data[idx:] if idx >= 0 else data
    return chunk.decode("latin-1", errors="replace")


def fix_swedish(title: str) -> str:
    """Best-effort restore å/ä/ö lost in latin-1 TEX exports."""
    repl = {
        "Innehll": "Innehåll",
        "rskurs": "årskurs",
        "lsr": "läsår",
        "mnesprov": "ämnesprov",
        "Samhllskunskap": "Samhällskunskap",
        "Rttsskerhet": "Rättssäkerhet",
        "Mnniskor": "Människor",
        "frndringar": "förändringar",
        "frngelse": "fängelse",
        "istllet": "istället",
        "fr": "för",
        "gra": "göra",
        "p": "på",
        "vrlden": "världen",
        "mjlighet": "möjlighet",
        "arbetslshet": "arbetslöshet",
        "Lgga": "Lägga",
        "Nr": "När",
        "lgger": "lägger",
        "begs": "begås",
        "g ur": "gå ur",
        "Kll": "Käll",
        "bn": "bön",
        "gudstro": "gudstro",
        "livsskdningar": "livsåskådningar",
        "livsfrgor": "livsfrågor",
        "dden": "döden",
        "populrkulturen": "populärkulturen",
        "verkligheten": "verkligheten",
        "ursprung": "ursprung",
        "inriktningar": "inriktningar",
        "frn": "från",
        "rstrtt": "rösträtt",
        "vlfrdssamhllet": "välfärdssamhället",
        "frndring": "förändring",
        "Regissr": "Regissör",
        "anvnder": "använder",
        "Grnser": "Gränser",
        "Pennfabriken": "Pennfabriken",
        "hlso": "hälsa",
        "Spr": "Spår",
        "tvling": "tävling",
        "Slutsatser": "Slutsatser",
    }
    out = title
    for k, v in sorted(repl.items(), key=lambda x: -len(x[0])):
        out = out.replace(k, v)
    return re.sub(r"\s+", " ", out).strip()


def parse_delprov(cnt_text: str) -> dict | None:
    if "Delprov A" in cnt_text:
        letter = "A"
        beteckning = "Delprov A"
    elif "Delprov B" in cnt_text:
        letter = "B"
        beteckning = "Delprov B"
    elif "Lärarinformation" in cnt_text or "Kopieringsunderlag" in cnt_text:
        return None
    else:
        return None

    questions: list[dict] = []
    for raw in cnt_text.split("\n"):
        line = re.sub(r"[\x00-\x1f\x7f-\x9f\\]+", " ", raw)
        line = re.sub(r"\s+", " ", line).strip()
        if not line or "Inneh" in line or "Till dig" in line or line.isdigit():
            continue
        m = re.match(r"([AB]\d+)\s+(.+?)\s+\d+(?:\s+\d+)*\s*$", line)
        if m:
            questions.append(
                {"code": m.group(1), "title": fix_swedish(m.group(2))}
            )
            continue
        m2 = re.match(r"^(.+?)\s+(\d{1,4}(?:\s+\d{1,4})*)\s*$", line)
        if m2:
            title = fix_swedish(m2.group(1).strip())
            if len(title) < 8 or title[0].isdigit():
                continue
            if any(x in title for x in ("Innehåll", "Text,", "förteckning", "Till dig")):
                continue
            n = len(questions) + 1
            questions.append({"code": f"{letter}{n}", "title": title})

    if not questions:
        return None

    return {"beteckning": beteckning, "letter": letter, "questions": questions}


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
            info_tag = f"I{code[1:]}CB"
            cnt_files = [
                n
                for n in z.namelist()
                if info_tag in n and n.endswith(".CNT") and f"{info_tag}1.CNT" in n
            ]
            for cnt_name in cnt_files:
                parsed = parse_delprov(decode_cnt(z.read(cnt_name)))
                if parsed:
                    packages.append(
                        {
                            "code": code,
                            "beteckning": parsed["beteckning"],
                            "questions": parsed["questions"],
                        }
                    )
                    break
    return packages


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: extract-tex-cnt.py <zip>", file=sys.stderr)
        sys.exit(1)
    result = extract_zip(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()