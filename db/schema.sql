-- =====================================================
-- npprov.se Database Schema
-- PostgreSQL (Supabase / Vercel Postgres / Neon)
-- Authoritative, provenance-heavy model for nationella prov
-- =====================================================

-- Enable necessary extensions
-- Supabase prefers pgcrypto for UUIDs (gen_random_uuid is more reliable)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For better text search

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE prov_arskurs AS ENUM ('ak3', 'ak6', 'ak9', 'gy');
CREATE TYPE prov_amn AS ENUM (
  'Matematik', 'Svenska', 'Svenska som andraspråk', 'Engelska',
  'Biologi', 'Fysik', 'Kemi', 'Historia', 'Geografi',
  'Samhällskunskap', 'Religionskunskap', 'Moderna språk'
);
CREATE TYPE prov_typ AS ENUM (
  'hela', 'delprov', 'exempel', 'bedomningsunderlag', 
  'bedomningsanvisningar', 'lararinformation', 'ovrigt'
);
CREATE TYPE fraga_typ AS ENUM (
  'flerval', 'kort_svar', 'lang_svar', 'muntlig', 'lyssna', 'lasa', 'skriva', 'ovrigt'
);
CREATE TYPE forklaring_status AS ENUM ('pending', 'approved', 'rejected', 'needs_revision');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Huvudtabell för ett nationellt prov (eller ett "materialpaket")
CREATE TABLE prov (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,                    -- t.ex. "ma-1a-vt2022" or "ak9-sv-2024-bedomning-b"
  
  ar INTEGER NOT NULL,                          -- 2016, 2017, ..., 2025
  termin TEXT,                                  -- 'VT', 'HT' eller NULL
  amne prov_amn NOT NULL,
  arskurs_kurs prov_arskurs NOT NULL,
  typ prov_typ NOT NULL,
  
  titel TEXT NOT NULL,
  beskrivning TEXT,
  
  -- Provenance & auktoritet
  kalla TEXT NOT NULL DEFAULT 'Skolverket',     -- Skolverket, Umeå universitet, Uppsala universitet, etc.
  kalla_url TEXT,                               -- Direktlänk till officiell källa
  publicerad_datum DATE,
  last_updated TIMESTAMPTZ DEFAULT now(),
  human_reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  
  -- Filer
  pdf_url TEXT,                                 -- Primär PDF (kan vara extern eller /prov/...)
  zip_url TEXT,                                 -- För hela material
  audio_urls JSONB,                             -- Array av ljudfiler för muntliga
  extra_files JSONB,                            -- Övriga filer
  
  -- Metadata
  max_poang_total INTEGER,
  antal_delprov INTEGER DEFAULT 1,
  metadata JSONB,                               -- Flexibelt: antal uppgifter, tid, etc.
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Delprov (t.ex. Delprov A, B, C, muntlig, etc.)
CREATE TABLE delprov (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prov_id UUID NOT NULL REFERENCES prov(id) ON DELETE CASCADE,
  
  beteckning TEXT NOT NULL,                     -- 'A', 'B', 'C', 'Muntlig', 'Höra', etc.
  titel TEXT,
  beskrivning TEXT,
  
  max_poang INTEGER,
  tid_minuter INTEGER,
  ordning INTEGER,                              -- Sortering inom provet
  
  -- Filer per delprov
  pdf_url TEXT,
  audio_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individuella frågor (detta är kärnan i Question Genome)
CREATE TABLE fraga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delprov_id UUID NOT NULL REFERENCES delprov(id) ON DELETE CASCADE,
  
  fraga_nummer TEXT NOT NULL,                   -- '1a', '3', 'Del 2 fråga 4' etc.
  typ fraga_typ NOT NULL,
  
  text TEXT NOT NULL,                           -- Frågetext (kan innehålla markdown)
  bild_url TEXT,                                -- Om det finns bild/tabell
  tabell_json JSONB,                            -- Strukturerad tabell-data om relevant
  
  svarsalternativ_json JSONB,                   -- För flerval: [{ "id": "a", "text": "..." }]
  korrekt_svar TEXT,                            -- "b" eller fri text / poängsättning
  
  max_poang INTEGER DEFAULT 1,
  svarstyp TEXT,                                -- 'exakt', 'poangintervall', etc.
  
  -- Svårighetsgrad & analys (beräknas / manuellt)
  svarighetsgrad NUMERIC(3,2),                  -- 0.0 - 1.0 eller 1-5
  vanliga_missforstand TEXT,
  varfor_viktig TEXT,                           -- Pedagogisk motivering
  
  -- Historik
  historiska_varianter JSONB,                   -- Länkar till liknande tidigare frågor
  
  -- Provenance
  kalla TEXT,
  last_updated TIMESTAMPTZ DEFAULT now(),
  human_reviewed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kunskapsmål (Lgr22 / Gy25) - Nyckeltabell för NP Question Genome Project
CREATE TABLE kunskapsmal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kod TEXT UNIQUE NOT NULL,                     -- T.ex. "MA1A.1.1" eller "SV9.3.2" – använd officiella koder
  kurs TEXT NOT NULL,                           -- "Matematik 1a", "Svenska åk 9", "Engelska 6" etc.
  beskrivning TEXT NOT NULL,
  
  -- Referens till läroplan
  lgr22_gy25_referens TEXT,                     -- "Lgr22 2.2.1" eller "Gy25 MA1A"
  amne prov_amn,
  arskurs_kurs TEXT,
  
  -- Hierarki
  foralder_id UUID REFERENCES kunskapsmal(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: Vilken fråga testar vilket kunskapsmål (många-till-många)
CREATE TABLE fraga_kunskapsmal (
  fraga_id UUID REFERENCES fraga(id) ON DELETE CASCADE,
  kunskapsmal_id UUID REFERENCES kunskapsmal(id) ON DELETE CASCADE,
  PRIMARY KEY (fraga_id, kunskapsmal_id),
  
  styrka NUMERIC(3,2) DEFAULT 1.0,              -- Hur starkt frågan testar målet (0-1)
  kommentar TEXT,
  
  added_by TEXT,                                -- 'system', 'lärare:namn', etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- COMMUNITY & PREDICTIVE
-- =====================================================

-- Community-förklaringar (modererad)
CREATE TABLE community_forklaring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraga_id UUID REFERENCES fraga(id) ON DELETE CASCADE,   -- nullable for general proposals, kunskapsmal links, etc.
  
  text TEXT NOT NULL,
  forfattare TEXT,                              -- Namn eller "Anonym lärare"
  forfattare_roll TEXT,                         -- 'lärare', 'elev', 'förälder'
  
  status forklaring_status DEFAULT 'pending',
  upvotes INTEGER DEFAULT 0,
  
  moderated_by TEXT,
  moderated_at TIMESTAMPTZ,
  moderation_note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Run this ALTER in Supabase SQL Editor if you have an older version of the table:
-- ALTER TABLE community_forklaring ALTER COLUMN fraga_id DROP NOT NULL;

-- Enkel användartabell (för framtida auth via Supabase Auth)
CREATE TABLE anvandare (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  namn TEXT,
  roll TEXT DEFAULT 'besokare',                  -- 'elev', 'lärare', 'admin', 'moderator'
  verified_larare BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trend & Predictive data (kan fyllas från Skolverket-statistik + egen analys)
CREATE TABLE trend_analys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amne prov_amn,
  arskurs_kurs TEXT,
  ar INTEGER,
  
  -- Statistik
  medelresultat NUMERIC(5,2),
  andel_godkant NUMERIC(5,2),
  svarighetsindex NUMERIC(5,2),
  
  -- Prediktiv
  forvantad_svarighet_gy25 TEXT,                -- "Ökar", "Minskar", "Oförändrad" + motivering
  trend_kommentar TEXT,
  
  kalla TEXT DEFAULT 'Skolverket + intern analys',
  kalla_url TEXT,
  
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEX & SEARCH
-- =====================================================
CREATE INDEX idx_prov_amne_ar ON prov(amne, ar DESC);
CREATE INDEX idx_prov_slug ON prov(slug);
CREATE INDEX idx_fraga_delprov ON fraga(delprov_id);
CREATE INDEX idx_fraga_kunskapsmal ON fraga_kunskapsmal(kunskapsmal_id);

-- Fulltext-sökning på frågor (bra för RAG / agenter)
ALTER TABLE fraga ADD COLUMN search_vector tsvector 
  GENERATED ALWAYS AS (to_tsvector('swedish', coalesce(text, '') || ' ' || coalesce(vanliga_missforstand, ''))) STORED;
CREATE INDEX idx_fraga_search ON fraga USING GIN (search_vector);

-- =====================================================
-- TRIGGERS (updated_at)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prov_updated_at BEFORE UPDATE ON prov
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS (användbara för sajten)
-- =====================================================
CREATE OR REPLACE VIEW prov_med_statistik AS
SELECT 
  p.*,
  COUNT(DISTINCT d.id) as antal_delprov_riktiga,
  COUNT(DISTINCT f.id) as antal_fragor
FROM prov p
LEFT JOIN delprov d ON d.prov_id = p.id
LEFT JOIN fraga f ON f.delprov_id = d.id
GROUP BY p.id;

COMMENT ON TABLE prov IS 'Huvudentitet för nationella prov och relaterade material. Alltid med stark provenance.';
COMMENT ON TABLE kunskapsmal IS 'Central tabell för NP Question Genome Project – kopplar frågor till Lgr22/Gy25 kunskapskrav.';
COMMENT ON TABLE fraga IS 'Atomär fråga. Detta är den mest värdefulla datan för både elever, lärare och AI-agenter.';

-- End of schema
