# npprov.se – Fas 1 Plan (MVP)

## Övergripande vision (bekräftad)
Positionering: "Sveriges mest kompletta, strukturerade och pedagogiskt genomtänkta arkiv för gamla nationella prov."

Ton: Professionell, lugn, auktoritativ, pedagogisk.
Allt på svenska.
Starkt fokus på provenance + agentic SEO / AEO (llms.txt, schema.org, semantisk struktur, tydliga källor).

Sajten kompletterar npmonstret.se (aldrig konkurrerar).

## Vad har gjorts hittills (start av Fas 1)

- Nytt Astro + Tailwind projekt initierat (npprov.se-astro)
- Databasmodell skapad (db/schema.sql) med tabeller:
  - prov, delprov, fraga, kunskapsmal, fraga_kunskapsmal
  - community_forklaring, anvandare, trend_analys
- TypeScript-typer (src/lib/types.ts)
- Legacy data importerad (109 poster från tidigare manifest)
- Exempel-PDF:er kopierade
- llms.txt + robots.txt optimerade för agenter
- Professionell Layout + global CSS
- Startsida + /prov lista + dynamisk exempel-sida /prov/[id] (med provenance)
- Astro config + Tailwind integration

## Prioriterad plan för Fas 1 (databas + grundstruktur + exempel-sida)

### Steg 1 – Databas & Data (högsta prioritet)
- [x] Skapa komplett schema.sql (klart)
- [ ] Sätt upp Supabase-projekt (rekommenderas)
- [ ] Skapa migrationer + RLS policies
- [ ] Bygg seed script som importerar manifest.json + strukturerar till prov + delprov (simplifierat)
- [ ] Skapa TypeScript interfaces + Zod schemas för validering
- [ ] Lägg till enkel import-verktyg (CLI eller admin-sida)

### Steg 2 – Grundstruktur & Sidor
- [x] Astro + Tailwind + Layout (klart)
- [x] Startsida med statistik + senaste (klart)
- [x] /prov lista (MVP, grupp per ämne) (klart)
- [x] /prov/[id] detaljsida med provenance (MVP) (klart)
- [ ] Bättre filter/sök (client-side först, sedan server)
- [ ] Sida för ett enskilt delprov + frågor (när vi har granular data)
- [ ] /genome – Question Genome översikt (heatmap per kurs)

### Steg 3 – SEO & Agentic
- [x] llms.txt (klart)
- [x] robots.txt (klart)
- [ ] schema.org markup (LearningResource, Quiz, Question, DefinedTerm) på alla sidor
- [ ] Sitemap + structured data
- [ ] Provenance-komponent som återanvänds överallt
- [ ] Meta-titlar och beskrivningar per prov/sida

### Steg 4 – Exempel på Per-fråga-djup
- Skapa en statisk eller content-driven detaljsida för en fråga (även om vi börjar med dummy-data)
- Inkludera:
  - Frågetext
  - Koppling till kunskapsmål (demo)
  - Vanliga missförstånd
  - "Varför är frågan viktig?"
  - Subtil CTA till npmonstret.se

### Steg 5 – Deployment & Verktyg
- Pusha till GitHub (privat repo)
- Koppla till Vercel
- Lägg till Supabase env-variabler
- Testa build + Lighthouse (prestanda)

## Nästa omedelbara åtgärder (efter denna plan)

1. Användaren bekräftar planen.
2. Vi sätter upp Supabase (jag guidar exakta SQL + policies).
3. Vi bygger ett seed script (TypeScript) som tar manifest + skapar prov + delprov-poster.
4. Vi förbättrar filter på /prov-sidan.
5. Vi lägger till schema.org på prov-sidan.
6. Deploy.

## Tech decisions (Fas 1)
- Astro Islands bara där det behövs (sök/filter kan vara client component)
- Data: Börja med JSON seed + Astro Content Collections. Gå över till Supabase när vi har autentiserad admin.
- Ingen tung CMS än.
- All text pedagogiskt korrekt svenska.

Denna plan följer exakt den prioritering som angavs i uppdraget.
