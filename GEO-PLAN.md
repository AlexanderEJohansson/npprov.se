# npprov.se – GEO-strategi (Geografi)

**Mål:** Den enda URL som ska vara starkare än npprov.se för nationella prov i geografi är [skolverket.se](https://www.skolverket.se/prov-och-bedomning/nationella-prov).

**Positionering:** npprov.se blir det bästa *strukturerade* arkivet – sökbara frågor, kunskapsmål, pedagogisk kontext och agentisk SEO – medan Skolverket/UU förblir den officiella primärkällan för rå-PDF:er.

---

## Nuläge (2026-07-10)

| Dimension | Status |
|-----------|--------|
| Åk 9 delprov sv 2013–2018 | ✅ 12/12 PDF:er lokalt |
| Strukturerade frågor | ✅ 95 (section-level) |
| Kunskapsmål GEO9.x | ✅ 3 koder, 99 junctions |
| Per-fråga-sidor | ✅ ~95 dedikerade URL:er |
| Question Genome | ✅ GEO9.1.1–3.1 med NP-Monstret-länkar |
| Bedömningsanvisningar | ❌ 0/6 år |
| Facit/korrekt_svar | ❌ 0 % |
| Engelska versioner | ❌ 0/10 |
| Kartmaterial | ❌ 2013 karthäfte saknas |
| Åk 6 geografi | ❌ 0 filer |
| Åk 9 2019 | ⏳ Sekretess till 2026-06-30 |
| Browse per läsår | ⚠️ 1 prov-rad, titel säger 2016 |

**Unik fördel idag:** npprov har redan det som Skolverket/UU saknar – sökbar per-fråga-struktur, genome-kopplingar och ekosystemlänkar (NP-Monstret, NP-guide).

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
| Missförstånd + pedagogik | Bedömningsanvisningar (tills vi har facit) |
| Agentisk SEO (llms.txt) | Policy & sekretessinfo |

---

## Faser

### Fas 0 – Snabbfixar (P0) ← *pågår nu*
- [x] Rätt prov-titel: "Geografi åk 9 (2013–2018)"
- [x] `delprov.pdf_url` per år/delprov
- [x] Ta bort felaktig `zip_url`
- [x] Uppdatera manifest med alla 12 delprov-PDF:er
- [x] `/kallor`: UU som värd för Geografi
- [x] `human_reviewed: false` på auto-parserade frågor
- [x] Deduplicera `fraga_kunskapsmal`
- [x] Hämta bedömningsanvisningar 2013–2018 (6 PDF:er) + karthäfte 2013

### Fas 1 – Arkivkomplett åk 9 ✅
- [x] Bedömningsanvisningar fetch + länkar via `metadata.extra_files` på prov-sida
- [x] Parser v2 (2013A, 2017A) + `expandLetteredSubQuestions`
- [x] Per-läsår: 6 prov-rader `geo-ak9-2013` … `geo-ak9-2018` + arkivindex `a8f3c2e91b`
- [x] Engelska versioner 2014–2018 i `public/prov/`
- [x] Karthäfte 2013 hämtat + länkat
- [x] Manifest: 121 poster inkl. per-läsår geo

### Fas 2 – Facit & uppgiftsnivå ✅ (delvis)
- [x] `seed-geo-facit.ts` → ~101 frågor med facit/bedömningskriterier (2016–2018)
- [x] Sub-question splitter (a/b/c-deluppgifter)
- [ ] PDF-bildextraktion (kartor) — kart-PDF länkad, ej `bild_url` extraktion än
- [x] `human_reviewed: false` på auto-parserade frågor
- [x] "Med facit"-filter på `/prov` (ärlig — kräver `korrekt_svar`)

### Fas 3 – Åk 6 + 2019 ✅ (delvis)
- [x] `seed-geo-ak6-pdfs.ts` — 5 prov, ~63 frågor
- [ ] 2019 åk 9 — UU länkar ej publicerade än (kolla efter 2026-06-30)
- [x] GEO9.x kunskapsmål i DB
- [x] `seed-geo-trends.ts` — 3 rader i trend_analys

### Fas 4 – Agentisk dominans ✅ (delvis)
- [x] DefinedTerm GEO9.x på frågesidor (befintlig `aboutDefinedTerm`)
- [x] llms.txt uppdaterad med geo-inventering
- [x] Sitemap via @astrojs/sitemap (alla statiska frågesidor)
- [x] EcosystemLinks (NP-Monstret/NP-guide)
- [x] `scripts/indexnow-ping.ts` + nyckel i `public/`

---

## Teknisk arkitektur

```
UU/Skolverket PDF:er
        ↓
fetch-skolverket.ts  →  public/prov/geo-ak9-{year}-*.pdf
        ↓
seed-geo-pdfs.ts     →  delprov + fraga + fraga_kunskapsmal
lib/geo-parse.ts     →  year-specific parsers
        ↓
Astro static pages   →  /prov/a8f3c2e91b/fraga/{id}
        ↓
/genome + llms.txt   →  agentisk SEO
```

**Nya scripts att bygga (Fas 1–2):**
- `seed-geo-facit.ts` – parsa bedömningsanvisningar → `korrekt_svar`
- `seed-geo-ak6-pdfs.ts` – åk 6 pipeline
- `extract-geo-images.ts` – kartor från PDF

---

## Ärlighetsprincip

npprov.se ska **aldrig** påstå sig ha facit om det saknas. Statusfält:
- `human_reviewed` – endast true efter manuell granskning
- `korrekt_svar` – endast från bedömningsanvisningar, aldrig gissat
- DataStatus-komponenten – visa "auto-parserad" vs "granskad"

Detta skiljer oss från generiska prov-sajter och bygger förtroende.

---

## Framgångsmått

| Mått | Nu | Mål Fas 2 | Mål Fas 3 |
|------|-----|-----------|-----------|
| ak9 delprov PDF:er | 12 | 18 (+bedömning) | 18 |
| Strukturerade frågor | 95 | 200+ | 300+ |
| Frågor med facit | 0 | 80 %+ | 95 %+ |
| Årskurser | ak9 | ak9 | ak6 + ak9 |
| Läsår | 2013–2018 | 2013–2018 | +2019 |
| Lighthouse SEO | ? | 95+ | 95+ |

---

## Nästa konkreta steg (efter Fas 0)

1. Kör `npm run fetch:skolverket -- --geo-only` med nya bedömnings-URL:er
2. Bygg `seed-geo-facit.ts` (börja med 2016 – bäst parser)
3. Splitta till 6 prov-rader i DB + manifest (ett läsår = en sökbar post på `/prov`)
4. Deploy + IndexNow-ping för geo-frågesidor

*Senast uppdaterad: 2026-07-10*