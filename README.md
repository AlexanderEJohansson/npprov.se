# npprov.se

Sveriges mest kompletta arkiv för gamla nationella prov.  
Byggt med Astro + Supabase + Vercel.

## Uppdatera sajten live (npprov.se) – ENKELT

**Bästa sättet (rekommenderas):** Ändra kod → commit → `git push`. Vercel bygger och deployar automatiskt till produktion.

### Första gången du sätter upp det (gör en gång)
1. Gå till [Vercel dashboard](https://vercel.com) → ditt projekt **npprov-se**
2. Klicka **Settings** (uppe till höger) → **Git** i vänstermenyn
3. Se till att ditt GitHub-repo är kopplat (Connect Git Repository om det inte är det)
4. Under **Production Branch** välj `main` (eller `master` om du använder det)
5. Spara

Därefter räcker det med vanlig git push till main – allt deployas automatiskt till npprov.se.

### Alternativ (manuell deploy via CLI)
Om du vill deploya utan att pusha (t.ex. preview eller akut fix):

```bash
npm run deploy
```

Preview (inte produktion):

```bash
npm run deploy:preview
```

**Viktigt:** Använd alltid ett email som är verifierat i ditt GitHub-konto (se avsnittet nedan om commit email). Annars blockeras deploys.

## Vanliga kommandon

| Kommando              | Vad det gör                              |
|-----------------------|------------------------------------------|
| `npm run dev`         | Starta lokal utvecklingsserver           |
| `npm run build`       | Bygg statiska filer till `dist/`         |
| `npm run deploy`      | Manuell deploy till produktion (fallback) |
| `npm run deploy:preview` | Deploya en preview-version          |

**Normalt flöde:** Ändra kod → `git add .` → `git commit -m "..."` → `git push` (auto-deploy via Vercel + Git).

## Projektstruktur (viktigt)

- `src/pages/prov.astro` → /prov (alla prov)
- `src/pages/prov/[id].astro` → individuella prov-sidor
- `src/pages/genome.astro` → Question Genome
- `public/llms.txt` + schema.org på sidorna → optimerat för AI-agenter

## Git + Vercel commit email problem

Vercel kräver att commit-author email matchar ett verifierat email i ditt GitHub-konto (säkerhetskontroll).

**Lösning (gör en gång):**

1. Gå till GitHub → Settings → Emails och kopiera ditt **primära** email (inte noreply).

2. I terminalen (i npprov.se-astro):

```bash
git config user.email "ditt-verifierade-email@exempel.com"
git config user.name "Ditt Namn"
git commit --amend --reset-author --no-edit
```

3. Sedan `git push --force-with-lease` (om du har remote) eller bara `git push`.

Därefter fungerar både `git push` (auto-deploy) och `npm run deploy`.

Använd **alltid** samma email i framtida commits så slipper du blockeringar.

## Teknisk stack (per spec)

- Astro (statisk + öar)
- Tailwind
- Supabase (live data)
- Vercel (hosting + deploys)
- Allt material har tydlig provenance + källor

Allt annat är dokumenterat i `PHASE1-PLAN.md` och `SUPABASE_SETUP.md`.

## Utveckling

```bash
npm install
npm run dev
```

Öppna http://localhost:4321

---

Har du frågor eller vill ändra något – säg bara till. Målet är att det ska vara **så enkelt som möjligt** att hålla sajten uppdaterad.
