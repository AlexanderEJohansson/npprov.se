# npprov.se – Supabase Setup (Project: alrxchmxuqaeonsvaogw)

Du har angett Supabase-projektet: https://supabase.com/dashboard/project/alrxchmxuqaeonsvaogw

## Steg-för-steg (kör i terminal från npprov.se-astro)

### 1. Installera / använd Supabase CLI

Vi använder `npx` så du slipper globala rättigheter:

```bash
# Testa att CLI fungerar
npx supabase --version

# Logga in (öppnar browser)
npx supabase login
```

### 2. Länka till ditt projekt

```bash
npx supabase link --project-ref alrxchmxuqaeonsvaogw
```

Bekräfta med `y` när den frågar.

### 3. Pusha schemat (vår migration)

Vi har redan skapat migrationen baserat på den fulla databasmodellen.

```bash
npx supabase db push
```

Detta kör `20250606183000_create_npprov_core_schema.sql` mot din databas.

Du kan verifiera i Supabase Studio → Table Editor att tabellerna `prov`, `delprov`, `fraga`, `kunskapsmal` etc. finns.

### 4. Skapa .env

```bash
cp .env.example .env
```

Öppna `.env` och fyll i värden från Supabase Dashboard:

- **Project Settings → API**
  - `PUBLIC_SUPABASE_URL` → `https://alrxchmxuqaeonsvaogw.supabase.co`
  - `PUBLIC_SUPABASE_ANON_KEY` → anon public key
  - `SUPABASE_SERVICE_ROLE_KEY` → service_role key (hemlig!)

**Viktigt:** Lägg aldrig `.env` i git.

### 5. Seed data (valfritt men rekommenderat för demo)

Efter att schemat är uppe:

```bash
# Installera tsx om du inte har det (för att köra TypeScript direkt)
npm install -D tsx

# 1. Grundläggande prov-poster (109 från manifest)
npx tsx scripts/seed-from-manifest.ts

# 2. Granulär data: kunskapsmal (Lgr22/Gy25), delprov + verkliga exempeluppgifter för de PDF:er som finns lokalt
npx tsx scripts/seed-granular-data.ts
```

Detta gör att /prov/[id]-sidorna och Question Genome börjar visa riktiga uppgifter, missförstånd och kopplingar istället för bara skelett. Kör steg 2 igen när du lagt till fler lokala PDF:er eller manuellt strukturerat fler frågor.

### 6. Generera TypeScript-typer (rekommenderas starkt)

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

Uppdatera sedan `src/lib/supabase.ts` för att importera de riktiga typerna.

### 7. Starta dev-servern

```bash
npm run dev
```

## Nästa steg efter setup

- Lägg till RLS-policies (Row Level Security) – vi kan göra detta tillsammans (t.ex. alla kan läsa, bara service_role kan skriva).
- Bygg en enkel admin-sida eller CLI för att lägga till nya prov.
- Koppla fråge-sidorna till riktig Supabase-data istället för statisk manifest.
- Lägg till `supabase gen types` i build-processen.

## Felsökning

- "relation does not exist" → Glömt att köra `npx supabase db push`
- "Invalid API key" → Kolla att du använder rätt keys från rätt projekt
- Vill du resetta databasen lokalt/test: `npx supabase db reset` (var försiktig i prod)

## Hjälp

Kör `npx supabase --help` eller säg till mig så guidar jag exakta kommandon eller skriver policies/seed-förbättringar.

När du kört `npx supabase db push` och seedat, säg till så fortsätter vi med att koppla frontend-sidorna till live-data + lägga till schema.org markup.
