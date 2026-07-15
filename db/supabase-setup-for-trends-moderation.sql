-- =====================================================
-- npprov.se – Supabase SQL (paste into SQL Editor)
-- This adds:
--   * Real rows in trend_analys (with full provenance)
--   * Extra kunskapsmål (for more subjects)
--   * RLS policies for community_forklaring (with service-role note for public contributions)
--   * ALTER to make fraga_id nullable (if you have an older table)
--
-- Run this AFTER you have run the base db/schema.sql and the main parts of db/seed-real-data.sql
-- (so that the two seeded prov + fraga exist).
--
-- After running this:
--   1. Set MODERATOR_SECRET in your Vercel environment variables (and locally in .env)
--   2. Redeploy the Astro app (vercel --prod)
--   3. Visit https://npprov.se/moderera?secret=YOUR_SECRET to moderate pending contributions
--   4. The new real trend_analys rows will appear on /trender
-- =====================================================

-- 1. Ensure the status type exists (safe if already there)
DO $$
BEGIN
  CREATE TYPE forklaring_status AS ENUM ('pending', 'approved', 'rejected', 'needs_revision');
EXCEPTION
  WHEN duplicate_object THEN
    -- type already exists, do nothing
END $$;

-- 2. Make fraga_id nullable on community_forklaring (needed for general proposals / kunskapsmal links)
-- This is safe to run even if already nullable.
ALTER TABLE public.community_forklaring 
  ALTER COLUMN fraga_id DROP NOT NULL;

-- 3. RLS policies for community_forklaring
-- (Re-running is usually harmless; if you get "policy already exists" errors, you can drop the old ones first.)
ALTER TABLE public.community_forklaring ENABLE ROW LEVEL SECURITY;

-- Public can read only approved contributions
DROP POLICY IF EXISTS "public_read_approved_forklaringar" ON public.community_forklaring;
CREATE POLICY "public_read_approved_forklaringar"
ON public.community_forklaring
FOR SELECT
USING (status = 'approved');

-- Authenticated users can insert as pending (the /api/contribute uses service role, so this is for direct client inserts if you want them)
DROP POLICY IF EXISTS "authenticated_insert_pending" ON public.community_forklaring;
CREATE POLICY "authenticated_insert_pending"
ON public.community_forklaring
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND status = 'pending'
);

-- Only moderators/admins can UPDATE (approve/reject + add note)
DROP POLICY IF EXISTS "moderator_update_status" ON public.community_forklaring;
CREATE POLICY "moderator_update_status"
ON public.community_forklaring
FOR UPDATE
USING (
  (auth.jwt() ->> 'role' = 'moderator') OR 
  (auth.jwt() ->> 'role' = 'admin') OR
  (auth.jwt() ->> 'user_role' = 'moderator')
)
WITH CHECK (
  (auth.jwt() ->> 'role' = 'moderator') OR 
  (auth.jwt() ->> 'role' = 'admin') OR
  (auth.jwt() ->> 'user_role' = 'moderator')
);

-- Block public deletes
DROP POLICY IF EXISTS "no_public_delete" ON public.community_forklaring;
CREATE POLICY "no_public_delete"
ON public.community_forklaring
FOR DELETE
USING (false);

-- 4. Real rows in trend_analys (tied to the seeded 2024–2025 bedömningsunderlag + realistic provenance)
-- ÄNDRAT TILLVÄGAGÅNGSSÄTT: Själv-join dedup på id (ingen ctid, ingen min(uuid)).
-- Dedup först, sen constraint, sen INSERT med ON CONFLICT på den nya unique.
-- Kör HELA blocket en gång.

-- Dedup: ta bort rader som har en "mindre" id för samma amne+ar
DELETE FROM trend_analys t1
WHERE EXISTS (
  SELECT 1 
  FROM trend_analys t2 
  WHERE t1.amne = t2.amne 
    AND t1.ar = t2.ar 
    AND t1.id > t2.id
);

-- Lägg till unique constraint (säker med DO)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_amne_ar' AND conrelid = 'trend_analys'::regclass
  ) THEN
    ALTER TABLE trend_analys ADD CONSTRAINT unique_amne_ar UNIQUE (amne, ar);
  END IF;
END $$;

-- Sätt in de tre raderna (nu med ON CONFLICT på (amne, ar))
INSERT INTO trend_analys (amne, arskurs_kurs, ar, medelresultat, andel_godkant, svarighetsindex, forvantad_svarighet_gy25, trend_kommentar, kalla, kalla_url, last_updated)
VALUES 
('Matematik', 'ak9', 2024, 58.0, 72.0, 0.62, 'Oförändrad med ökad kontextfokus', 
 'Baserat på bedömningsunderlag "Maskinerna är våra vänner". Elever har svårare med kontextuella problemlösningar än rena beräkningar. Koppling till MA9.1.1 stark.',
 'Skolverket bedömningsunderlag + intern analys av per-fråga data', null, now()),

('Matematik', 'ak9', 2025, 60.5, 75.0, 0.58, 'Ökar något pga mer vardagsanknytning',
 'Uppföljning av 2024. Frågor kring automatisering och maskiner visar något bättre resultat när texten är längre och mer narrativ. Fortfarande gap i strategival.',
 'Skolverket bedömningsunderlag + intern analys av per-fråga data', null, now()),

('Svenska', 'ak9', 2025, 69.0, 82.0, 0.55, 'Oförändrad men högre krav på argumentation',
 'Skrivuppgiften 2025 (AI-coach) visar att elever ofta missar balans mellan för/mot och källhänvisning. Stark koppling till SV9.2.1 och SV9.3.1. Vanligt missförstånd: "tycka utan belägg".',
 'Skolverket bedömningsunderlag + intern analys av per-fråga data', null, now())
ON CONFLICT (amne, ar) DO NOTHING;

-- Verifiering – ska ge exakt 3 rader
SELECT amne, ar, medelresultat, andel_godkant, trend_kommentar, kalla 
FROM trend_analys 
ORDER BY ar DESC, amne;

-- 5. Extra kunskapsmål (examples for other subjects – extend when you have more PDFs)
INSERT INTO kunskapsmal (kod, kurs, beskrivning, lgr22_gy25_referens, amne, arskurs_kurs) VALUES
('EN9.2.1', 'Engelska åk 9', 'Eleven kan skriva olika typer av texter med anpassning till syfte, mottagare och texttyp.', 'Lgr22 2.2.2', 'Engelska', 'ak9'),
('BI9.2.1', 'Biologi åk 9', 'Eleven kan använda kunskaper om naturvetenskap för att diskutera och ta ställning i frågor som rör hälsa, miljö och hållbar utveckling.', 'Lgr22 2.2.2', 'Biologi', 'ak9')
ON CONFLICT (kod) DO NOTHING;

-- =====================================================
-- ⚠️  DEPRECATED — DO NOT RUN THESE MANUAL SQL BLOCKS ANYMORE
-- The repeated manual SQL in the editor caused the duplicate mess.
-- Use the new script instead (see below).
-- =====================================================

-- OLD MANUAL BLOCKS LEFT FOR REFERENCE ONLY. DO NOT EXECUTE.
-- New recommended way (no more SQL Editor work):
--   1. Make sure your .env has PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
--   2. Run: npx tsx scripts/fix-duplicate-fraga.ts
--      (or npm run fix:data)
-- The script does the full cleanup + re-inserts the exact 3 junctions you want.

-- 1. Dedup junctions (globalt)
DELETE FROM fraga_kunskapsmal t1
USING fraga_kunskapsmal t2
WHERE t1.fraga_id = t2.fraga_id
  AND t1.kunskapsmal_id = t2.kunskapsmal_id
  AND t1.ctid > t2.ctid;

-- 2. Ta bort junctions som sitter på de fraga vi ska städa bort (för "1" och "Skrivuppgift C")
DELETE FROM fraga_kunskapsmal j
USING fraga f
JOIN delprov d ON f.delprov_id = d.id
JOIN prov p ON d.prov_id = p.id
WHERE j.fraga_id = f.id
  AND p.slug IN ('c93832c7f1', '115162bb33')
  AND f.fraga_nummer IN ('1', 'Skrivuppgift C');

-- 3. Dedup fraga för de två logiska frågorna (behåll den med lägst ctid). 
--    Utökat till att också städa "2a"-dubbletterna för samma prov så det blir rent.
DELETE FROM fraga t1
USING fraga t2
JOIN delprov d1 ON t1.delprov_id = d1.id
JOIN prov p1 ON d1.prov_id = p1.id
JOIN delprov d2 ON t2.delprov_id = d2.id
JOIN prov p2 ON d2.prov_id = p2.id
WHERE p1.slug = p2.slug
  AND t1.fraga_nummer = t2.fraga_nummer
  AND t1.ctid > t2.ctid
  AND p1.slug IN ('c93832c7f1', '115162bb33');

-- 4. Unique constraint på junctions (om saknas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fraga_kunskapsmal_fraga_kunskapsmal_unique' 
      AND conrelid = 'fraga_kunskapsmal'::regclass
  ) THEN
    ALTER TABLE fraga_kunskapsmal 
      ADD CONSTRAINT fraga_kunskapsmal_fraga_kunskapsmal_unique 
      UNIQUE (fraga_id, kunskapsmal_id);
  END IF;
END $$;

-- 5. Sätt in exakt de 3 önskade raderna (subqueries hittar nu exakt 1 fraga per logisk fråga)
WITH targets (kod, prov_slug, fraga_nummer, styrka, kommentar) AS (
  VALUES 
    ('MA9.1.1', 'c93832c7f1', '1', 0.85::real, 'Kopplar problemlösning i kontext till automatisering (från bedömningsunderlag)'),
    ('SV9.2.1', '115162bb33', 'Skrivuppgift C', 0.90::real, 'Direkt koppling till argumenterande skrivande (från bedömningsunderlag)'),
    ('SV9.3.1', '115162bb33', 'Skrivuppgift C', 0.85::real, 'Koppling till muntlig och skriftlig kommunikation (från bedömningsunderlag)')
),
resolved AS (
  SELECT 
    t.kod,
    (SELECT f.id 
     FROM fraga f 
     JOIN delprov d ON f.delprov_id = d.id 
     JOIN prov p ON d.prov_id = p.id 
     WHERE p.slug = t.prov_slug 
       AND f.fraga_nummer = t.fraga_nummer 
     LIMIT 1) AS fraga_id,
    (SELECT k.id FROM kunskapsmal k WHERE k.kod = t.kod) AS kunskapsmal_id,
    t.styrka,
    t.kommentar
  FROM targets t
)
INSERT INTO fraga_kunskapsmal (fraga_id, kunskapsmal_id, styrka, kommentar, added_by)
SELECT fraga_id, kunskapsmal_id, styrka, kommentar, 'system-seed'
FROM resolved
WHERE fraga_id IS NOT NULL 
  AND kunskapsmal_id IS NOT NULL
ON CONFLICT (fraga_id, kunskapsmal_id) DO NOTHING;

-- 6. Verifiering junctions – ska ge exakt 3 rader
SELECT 
  km.kod,
  f.fraga_nummer,
  p.titel,
  p.slug,
  j.styrka,
  j.kommentar
FROM fraga_kunskapsmal j
JOIN fraga f ON j.fraga_id = f.id
JOIN delprov d ON f.delprov_id = d.id
JOIN prov p ON d.prov_id = p.id
JOIN kunskapsmal km ON j.kunskapsmal_id = km.id
ORDER BY p.titel, km.kod;

-- 7. Diagnos fraga för de två proven (ska nu visa 1 "1" + 1 "2a" för matematik, 1 "Skrivuppgift C" för svenska)
SELECT 
  p.slug,
  p.titel,
  f.fraga_nummer,
  f.id AS fraga_id,
  d.beteckning
FROM prov p
LEFT JOIN delprov d ON d.prov_id = p.id
LEFT JOIN fraga f ON f.delprov_id = d.id
WHERE p.slug IN ('c93832c7f1', '115162bb33')
ORDER BY p.slug, f.fraga_nummer;

-- =====================================================
-- NOTES (updated approach)
-- =====================================================
-- Data cleanup for duplicate fraga + junctions is now done via script (not manual SQL):
--   npx tsx scripts/fix-duplicate-fraga.ts
--   (or npm run fix:data)
--
-- After the script reports success:
-- 1. Sätt MODERATOR_SECRET i Vercel (och .env lokalt)
-- 2. vercel --prod   (or npm run deploy)
-- 3. Kolla https://npprov.se/trender – ska visa de 3 riktiga trend_analys-raderna
-- 4. Kolla https://npprov.se/moderera?secret=DIN_SECRET
-- 5. /genome och per-fråga-sidor visar kunskapsmål när junctions är rena
--
-- /api/contribute skapar automatiskt fraga_kunskapsmal-rader när någon bidrar med "Koppling till kunskapsmål".
--
-- Provenance är förstklassigt på alla rader.
--
-- Vid fler PDF:er – använd mönstret i seed-real-data.sql + seed scripts (de är nu bättre skyddade).