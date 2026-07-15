# npprov.se – GEO-strategi (Geografi)

**Mål:** Den enda URL som ska vara starkare än npprov.se för nationella prov i geografi är [skolverket.se](https://www.skolverket.se/prov-och-bedomning/nationella-prov).

**Positionering:** npprov.se blir det bästa *strukturerade* arkivet – sökbara frågor, kunskapsmål, pedagogisk kontext och agentisk SEO – medan Skolverket/UU förblir den officiella primärkällan för rå-PDF:er.

---

## Nuläge (2026-07-15)

| Dimension | Status |
|-----------|--------|
| Åk 9 delprov sv 2013–2018 | ✅ 12/12 PDF:er lokalt |
| Åk 6 prov 2013–2015 + 2017 | ✅ 16 PDF:er + bedömning lokalt |
| Strukturerade GEO-frågor | ✅ 323 (åk 9: 271, åk 6: 52) |
| Kunskapsmål GEO9.x | ✅ 3 koder, junctions i DB |
| Per-fråga-sidor | ✅ ~323 dedikerade URL:er |
| Question Genome | ✅ GEO9.1.1–3.1 med NP-Monstret-länkar |
| Bedömningsanvisningar åk 9 | ✅ 6/6 år (2013–2018) |
| Facit/korrekt_svar GEO | ✅ **319/323 (99 %)** |
| Facit åk 9 2013–2018 | ✅ 271/271 (100 %) |
| Facit åk 6 | ✅ 48/52 (92 %) — 2013 omparserad (9 uppgifter) |
| Engelska versioner åk 9 | ✅ 2014–2018 i `public/prov/` |
| Kartmaterial | ✅ Karthäfte/kartblad länkade (ej `bild_url`-extraktion) |
| Browse per läsår | ✅ `geo-ak9-2013` … `geo-ak9-2018` + åk 6-rader |
| Åk 9 2019 | ⏳ UU har **inga nedladdningslänkar** än (sekretess förlängd till 2026-06-30 p.g.a. inställda digitala prov 2024/25) |
| Human review GEO | ❌ 0/323 granskade (`/moderera`) |

**Unik fördel idag:** npprov har redan det som Skolverket/UU saknar – sökbar per-fråga-struktur, facit från bedömnings-PDF:er, genome-kopplingar och ekosystemlänkar (NP-Monstret, NP-guide).

---

## Konkurrensanalys

### skolverket.se
- Officiell lista, auktoritet, alltid uppdaterad policy
- Geografi åk 9 → länkar till UU (inga egna ZIP/TEX)
- Ingen per-fråga-struktur, inget genome, inga pedagogiska metadata

### uu.se (Uppsala universitet)
- Full PDF-arkiv: delprov, bedömningsanvisningar, eng, kartor
- Åk 6 + åk 9 2013–2018 komplett
- Rå PDF:er utan sök, utan kunskapsmål-koppling

### npprov.se (målbild)
| Vi slår UU/Skolverket på | Vi länkar alltid till dem för |
|--------------------------|-------------------------------|
| Sök & filter per ämne/år | Officiell primär-PDF |
| Per-fråga-URL + schema.org | Juridisk provenance |
| GEO9 genome + NP-Monstret | Råmaterial auktoritet |
| Facit + bedömningskriterier | Bedömningsanvisningar (källa) |
| Agentisk SEO (llms.txt) | Policy & sekretessinfo |

---

## Faser

### Fas 0 – Snabbfixar (P0) ✅
- [x] Rätt prov-titel, `delprov.pdf_url`, manifest, `/kallor`, dedup junctions
- [x] Bedömningsanvisningar 2013–2018 + karthäfte 2013

### Fas 1 – Arkivkomplett åk 9 ✅
- [x] Parser v2 (2013A, 2017A) + `expandLetteredSubQuestions`
- [x] Per-läsår: 6 prov-rader `geo-ak9-2013` … `geo-ak9-2018`
- [x] Engelska 2014–2018, karthäfte, manifest

### Fas 2 – Facit & uppgiftsnivå ✅ (delvis)
- [x] `seed-geo-facit.ts` — åk 9: 100 %, åk 6: 92 %
- [x] `reseed-geo-year.ts`, `reseed-geo-ak6-year.ts`
- [x] Åk 6 2013: dedikerad marker-parser (9 bedömningsuppgifter)
- [ ] PDF-bildextraktion (`extract-geo-images.ts`) — kart-PDF länkad, ej `bild_url`
- [x] "Med facit"-filter på `/prov`

### Fas 3 – Åk 6 + 2019 ✅ (delvis)
- [x] `seed-geo-ak6-pdfs.ts` + `seed-geo-facit.ts --ak6-only`
- [ ] **2019 åk 9** — väntar på UU-publicering (inga PDF-länkar på [aldre-prov](https://www.uu.se/nationella-prov/geografi/aldre-prov-och-bedomningsstod) 2026-07-15)
- [x] `seed-geo-trends.ts`

### Fas 4 – Agentisk dominans ✅ (delvis)
- [x] DefinedTerm GEO9.x, llms.txt, sitemap, EcosystemLinks
- [x] `scripts/indexnow-ping.ts` + nyckel i `public/`
- [ ] IndexNow efter varje deploy (körs manuellt / CI)

---

## Teknisk arkitektur

```
UU/Skolverket PDF:er
        ↓
fetch-skolverket.ts  →  public/prov/geo-ak9-{year}-*.pdf
        ↓
seed-geo-pdfs.ts     →  delprov + fraga (åk 9)
seed-geo-ak6-pdfs.ts →  åk 6
lib/geo-parse.ts     →  year/nivå-specifika parsers
seed-geo-facit.ts    →  korrekt_svar från bedömnings-PDF
        ↓
Astro static pages   →  /prov/geo-ak9-2016/fraga/{id}
        ↓
/genome + llms.txt   →  agentisk SEO
```

**Scripts:**
- `npm run seed:geo:facit` — åk 9 + åk 6
- `npm run reseed:geo:year -- --year 2013` — åk 9 ett läsår
- `npm run reseed:geo:ak6:year -- --year 2013` — åk 6 ett läsår
- `npm run indexnow:geo` — ping efter deploy

**Kvar att bygga:**
- `extract-geo-images.ts` — kartor från PDF → `bild_url`
- `geo-ak9-2019` pipeline när UU publicerar

---

## Ärlighetsprincip

npprov.se ska **aldrig** påstå sig ha facit om det saknas. Statusfält:
- `human_reviewed` – endast true efter manuell granskning
- `korrekt_svar` – endast från bedömningsanvisningar, aldrig gissat
- DataStatus-komponenten – visa "auto-parserad" vs "granskad"

---

## Framgångsmått

| Mått | Nu (2026-07-15) | Mål |
|------|-----------------|-----|
| ak9 delprov PDF:er | 12 + bedömning + eng | +2019 när UU släpper |
| GEO-strukturerade frågor | 323 | 350+ med 2019 |
| GEO frågor med facit | **319/323 (99 %)** | 95 %+ ✅ |
| Årskurser | ak6 + ak9 | +2019 |
| Läsår åk 9 | 2013–2018 | +2019 |
| Human review GEO | 0 % | löpande via `/moderera` |

---

## Nästa steg

1. **2019** — polla UU efter PDF-länkar → `fetch-skolverket` + seed + facit
2. **4 GEO-frågor utan facit** — åk 6 2014 A2, 2015 B (3 st): parser/facit-tema
3. **Human review** — `/moderera` för GEO
4. **`extract-geo-images.ts`** — kartbilder
5. **Övriga ämnen** — Ma 349/563 (lokala gym-PDF:er uttömda); Sv/En kräver DOCX/TEX-bedömning (ej PDF-facit)

*Senast uppdaterad: 2026-07-15*