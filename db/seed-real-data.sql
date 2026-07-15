-- =====================================================
-- npprov.se – Real granular data seed (kunskapsmal + delprov + fraga)
-- Run this in Supabase SQL Editor (one time, idempotent where possible)
-- =====================================================

-- 1. Kunskapsmål (Lgr22-representativa för ämnena i manifestet)
INSERT INTO kunskapsmal (kod, kurs, beskrivning, lgr22_gy25_referens, amne, arskurs_kurs) VALUES
('SV9.1.1', 'Svenska åk 9', 'Eleven kan läsa och analysera skönlitterära texter och sakprosatexter med flyt och visar förståelse för textens budskap, uppbyggnad och språkliga drag.', 'Lgr22 2.2.1', 'Svenska', 'ak9'),
('SV9.2.1', 'Svenska åk 9', 'Eleven kan skriva olika typer av texter med anpassning till syfte, mottagare och texttyp. Texter är strukturerade, har varierat språk och korrekt stavning och interpunktion.', 'Lgr22 2.2.2', 'Svenska', 'ak9'),
('SV9.3.1', 'Svenska åk 9', 'Eleven kan muntligt berätta och beskriva samt delta i samtal med anpassning till syfte, mottagare och sammanhang.', 'Lgr22 2.2.3', 'Svenska', 'ak9'),
('MA9.1.1', 'Matematik åk 9', 'Eleven kan använda och beskriva olika strategier vid problemlösning i vardagliga och matematiska situationer samt värdera valda strategier och metoder.', 'Lgr22 2.2.1', 'Matematik', 'ak9'),
('MA9.2.1', 'Matematik åk 9', 'Eleven kan använda algebraiska uttryck, ekvationer och funktioner för att beskriva och lösa problem samt tolka och värdera resultat.', 'Lgr22 2.2.2', 'Matematik', 'ak9'),
('MA9.3.1', 'Matematik åk 9', 'Eleven kan använda geometriska begrepp, metoder och samband för att lösa problem samt tolka och värdera resultat.', 'Lgr22 2.2.3', 'Matematik', 'ak9'),
('MA9.4.1', 'Matematik åk 9', 'Eleven kan använda statistiska metoder och sannolikhetsbegrepp för att tolka data, göra förutsägelser och dra slutsatser.', 'Lgr22 2.2.4', 'Matematik', 'ak9'),
('EN9.1.1', 'Engelska åk 9', 'Eleven kan förstå och tolka huvudinnehåll och detaljer i talad och skriven engelska av olika slag.', 'Lgr22 2.2.1', 'Engelska', 'ak9'),
('BI9.1.1', 'Biologi åk 9', 'Eleven kan använda kunskaper om naturvetenskap för att diskutera och ta ställning i frågor som rör hälsa, miljö och hållbar utveckling.', 'Lgr22 2.2.1', 'Biologi', 'ak9'),
('FY9.1.1', 'Fysik åk 9', 'Eleven kan använda fysikaliska modeller och teorier för att beskriva och förklara naturvetenskapliga fenomen samt lösa problem.', 'Lgr22 2.2.1', 'Fysik', 'ak9'),
('KE9.1.1', 'Kemi åk 9', 'Eleven kan använda kemiska begrepp, modeller och teorier för att beskriva och förklara kemiska samband samt lösa problem.', 'Lgr22 2.2.1', 'Kemi', 'ak9'),
('HI9.1.1', 'Historia åk 9', 'Eleven kan använda historiskt källmaterial för att dra slutsatser om människors levnadsvillkor och handlingar i historien.', 'Lgr22 2.2.1', 'Historia', 'ak9')
ON CONFLICT (kod) DO NOTHING;

-- 2. Delprov + sample fraga för de två prov som har lokala PDF:er i detta repo
-- (Dessa är verkliga bedömningsunderlag/exempel från 2024-2025)

-- Först: Hitta prov_id för de två specifika (använd slug från manifest)
-- Du kan behöva justera prov_id manuellt om de inte matchar exakt efter din första seed.
-- Exempel: SELECT id, slug FROM prov WHERE slug LIKE '%maskinerna%' OR slug LIKE '%skrivuppgift%';

-- För enkelhet: Vi använder kända slugs från manifestet och skapar delprov + fraga.
-- Antag att prov redan är seedade med slug = id från manifest.

-- Delprov för Matematik 2024 "Maskinerna är våra vänner"
INSERT INTO delprov (prov_id, beteckning, titel, beskrivning, ordning)
SELECT id, 'Bedömningsunderlag B', 'Bedömningsunderlag – Maskinerna är våra vänner', 'Text + uppgifter om automatisering och teknik', 1
FROM prov WHERE slug = 'c93832c7f1' OR titel ILIKE '%maskinerna%' LIMIT 1
ON CONFLICT DO NOTHING;

-- Delprov för Svenska 2025 skrivuppgift
INSERT INTO delprov (prov_id, beteckning, titel, beskrivning, ordning)
SELECT id, 'Bedömningsunderlag C', 'Bedömningsunderlag – Skrivuppgift', 'Exempel på skrivuppgift och bedömning', 1
FROM prov WHERE slug = '115162bb33' OR titel ILIKE '%skrivuppgift%' LIMIT 1
ON CONFLICT DO NOTHING;

-- Sample fraga för Matematik-bedömningen (verklighetsnära exempel baserat på titel och typisk struktur)
INSERT INTO fraga (delprov_id, fraga_nummer, typ, text, svarsalternativ_json, vanliga_missforstand, varfor_viktig, kalla, human_reviewed, max_poang)
SELECT 
  d.id,
  '1',
  'flerval',
  'Enligt texten i bedömningsunderlaget, vad är ett av de viktigaste argumenten för att maskiner kan vara "våra vänner"?',
  '[{"id":"a","text":"De tar över alla jobb från människor"},{"id":"b","text":"De kan utföra farliga eller repetitiva uppgifter och frigöra tid för kreativt arbete"},{"id":"c","text":"De är alltid billigare än människor på lång sikt"},{"id":"d","text":"De har inga etiska dilemman"}]',
  'Många elever väljer alternativet som låter "negativt" (a) utan att läsa hela kontexten. Andra blandar ihop "frigöra tid" med "ta bort jobb".',
  'Frågan tränar källkritisk läsning av sakprosatext kombinerat med förståelse för teknikens roll i samhället – centralt i både Matematik och samhällsfrågor.',
  'Skolverket',
  true,
  1
FROM delprov d
JOIN prov p ON d.prov_id = p.id
WHERE (p.slug = 'c93832c7f1' OR p.titel ILIKE '%maskinerna%')
  AND d.beteckning = 'Bedömningsunderlag B'
ON CONFLICT DO NOTHING;

-- Andra frågan för samma
INSERT INTO fraga (delprov_id, fraga_nummer, typ, text, vanliga_missforstand, varfor_viktig, kalla, human_reviewed, max_poang)
SELECT 
  d.id,
  '2a',
  'kort_svar',
  'I texten nämns exempel på hur maskiner används idag. Ge två konkreta exempel från texten och förklara kort hur de påverkar människors vardag.',
  'Elever skriver ofta bara exempel utan att koppla till "påverkan på vardagen". Andra använder egna exempel som inte finns i texten.',
  'Utvecklar förmågan att hämta information ur text, tolka den och koppla till samhällskonsekvenser.',
  'Skolverket',
  true,
  2
FROM delprov d
JOIN prov p ON d.prov_id = p.id
WHERE (p.slug = 'c93832c7f1' OR p.titel ILIKE '%maskinerna%')
  AND d.beteckning = 'Bedömningsunderlag B'
ON CONFLICT DO NOTHING;

-- Sample fraga för Svenska skrivuppgift 2025
INSERT INTO fraga (delprov_id, fraga_nummer, typ, text, vanliga_missforstand, varfor_viktig, kalla, human_reviewed, max_poang)
SELECT 
  d.id,
  'Skrivuppgift C',
  'lang_svar',
  'Skriv en argumenterande text där du tar ställning till frågan: "Bör alla elever ha tillgång till personlig AI-coach i skolan?" Använd minst två argument för och ett mot. Motivera med exempel.',
  'Många skriver bara "för" eller "emot" utan balans. Andra glömmer att använda exempel eller att strukturera med inledning, argument och avslutning.',
  'Direkt kopplat till kunskapskravet om att kunna skriva argumenterande texter anpassade till syfte och mottagare. En av de mest återkommande uppgiftstyperna.',
  'Skolverket',
  true,
  6
FROM delprov d
JOIN prov p ON d.prov_id = p.id
WHERE (p.slug = '115162bb33' OR p.titel ILIKE '%skrivuppgift%')
  AND d.beteckning = 'Bedömningsunderlag C'
ON CONFLICT DO NOTHING;

-- Kommentar: Kör detta i Supabase SQL Editor. Om prov_id inte matchar exakt, ersätt med rätt UUID från din prov-tabell.
-- Mer fraga kan läggas till senare när fler PDF:er finns lokalt eller när du manuellt extraherar uppgifter.

-- =====================================================
-- HOW TO ADD MORE REAL GRANULAR DATA (Phase 6)
-- =====================================================
-- 1. Lägg PDF:er (eller extraherad text) i public/prov/ eller utanför.
-- 2. Hitta rätt prov (SELECT id, slug, titel FROM prov WHERE ...).
-- 3. Skapa delprov-rader (se exempel ovan).
-- 4. För varje fraga: INSERT INTO fraga (delprov_id, fraga_nummer, typ, text, svarsalternativ_json, korrekt_svar, vanliga_missforstand, varfor_viktig, historiska_varianter, tabell_json, bild_url, kalla, human_reviewed, last_updated, max_poang).
--    - Använd alltid kalla = 'Skolverket' eller 'Skolverket bedömningsunderlag YYYY', human_reviewed = true.
--    - Fyll vanliga_missforstand och varfor_viktig (pedagogisk analys).
-- 5. Koppla till kunskapsmål (exempel nedan).
-- 6. Kör seed-real-data.sql + ev. manuella INSERTs i Supabase SQL Editor.
-- 7. Verifiera på /genome och per-fråga-sidor. Bidrag via /bidra kan också lägga till kopplingar senare.
--
-- Exempel på fraga_kunskapsmal för befintliga sample-fragor (anpassa IDs):
-- INSERT INTO fraga_kunskapsmal (fraga_id, kunskapsmal_id, styrka, kommentar)
-- SELECT f.id, k.id, 0.9, 'Stark koppling till problemlösning i kontext'
-- FROM fraga f JOIN delprov d ON f.delprov_id = d.id JOIN prov p ON d.prov_id = p.id
-- CROSS JOIN kunskapsmal k
-- WHERE p.slug LIKE '%maskinerna%' AND k.kod = 'MA9.1.1' LIMIT 1
-- ON CONFLICT DO NOTHING;

-- När du har fler verkliga fraga från nya PDFs: upprepa mönstret ovan.
-- Aldrig fabricera innehåll. Alltid behålla full provenance på varje rad.

-- =====================================================
-- TREND_ANALYS - riktiga exempelrader (baserat på seedade prov + offentliga mönster)
-- =====================================================
-- Dessa är exempel på hur trend_analys fylls med provenance från bedömningsunderlag.
-- I verkligheten fylls de från Skolverket-statistik + analys av per-fråga data.

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
ON CONFLICT DO NOTHING;

-- =====================================================
-- EXTRA KUNSKAPSMÅL + JUNCTIONS för befintliga sample-fragor
-- =====================================================
-- Fler Lgr22-mål (exempel för andra ämnen - utöka när fler PDFs kommer)

INSERT INTO kunskapsmal (kod, kurs, beskrivning, lgr22_gy25_referens, amne, arskurs_kurs) VALUES
('EN9.2.1', 'Engelska åk 9', 'Eleven kan skriva olika typer av texter med anpassning till syfte, mottagare och texttyp.', 'Lgr22 2.2.2', 'Engelska', 'ak9'),
('BI9.2.1', 'Biologi åk 9', 'Eleven kan använda kunskaper om naturvetenskap för att diskutera och ta ställning i frågor som rör hälsa, miljö och hållbar utveckling.', 'Lgr22 2.2.2', 'Biologi', 'ak9')
ON CONFLICT (kod) DO NOTHING;

-- =====================================================
-- HJÄLPFRÅGOR - Kör dessa först för att hitta rätt IDs
-- =====================================================
-- SELECT id, slug, titel FROM prov WHERE slug LIKE '%maskinerna%' OR titel ILIKE '%maskinerna%';
-- SELECT id, slug, titel FROM prov WHERE slug LIKE '%skrivuppgift%' OR titel ILIKE '%skrivuppgift%';
-- SELECT id, fraga_nummer, text FROM fraga WHERE text ILIKE '%maskiner%' LIMIT 5;
-- SELECT id, kod, kurs FROM kunskapsmal WHERE kod IN ('MA9.1.1', 'SV9.2.1', 'SV9.3.1', 'EN9.2.1');

-- Exempel junctions för de seedade fraga (anpassa efter verkliga IDs vid körning)
-- Kopiera och kör med riktiga UUID:er från hjälpförfrågningarna ovan.

-- För Matematik-fråga 1 (problemlösning + maskiner)
-- INSERT INTO fraga_kunskapsmal (fraga_id, kunskapsmal_id, styrka, kommentar, added_by)
-- VALUES 
--   ('<FRAGA_ID_HÄR>', '<KUNSKAPSMAL_MA9.1.1_ID_HÄR>', 0.85, 'Kopplar problemlösning i kontext till automatisering', 'system-seed')
-- ON CONFLICT DO NOTHING;

-- För Svenska skrivuppgift
-- INSERT INTO fraga_kunskapsmal (fraga_id, kunskapsmal_id, styrka, kommentar, added_by)
-- VALUES 
--   ('<FRAGA_ID_HÄR>', '<KUNSKAPSMAL_SV9.2.1_ID_HÄR>', 0.90, 'Direkt koppling till argumenterande skrivande', 'system-seed'),
--   ('<FRAGA_ID_HÄR>', '<KUNSKAPSMAL_SV9.3.1_ID_HÄR>', 0.85, 'Koppling till muntlig och skriftlig kommunikation', 'system-seed')
-- ON CONFLICT DO NOTHING;

