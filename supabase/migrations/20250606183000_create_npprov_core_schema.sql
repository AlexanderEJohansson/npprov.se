-- =====================================================
-- npprov.se Database Schema - Migration 001
-- Project: alrxchmxuqaeonsvaogw
-- Generated from db/schema.sql
-- Run with: npx supabase db push
-- =====================================================

-- Enable necessary extensions
-- Supabase prefers pgcrypto for UUIDs (gen_random_uuid is more reliable)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUMS
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

CREATE TABLE prov (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  
  ar INTEGER NOT NULL,
  termin TEXT,
  amne prov_amn NOT NULL,
  arskurs_kurs prov_arskurs NOT NULL,
  typ prov_typ NOT NULL,
  
  titel TEXT NOT NULL,
  beskrivning TEXT,
  
  kalla TEXT NOT NULL DEFAULT 'Skolverket',
  kalla_url TEXT,
  publicerad_datum DATE,
  last_updated TIMESTAMPTZ DEFAULT now(),
  human_reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  
  pdf_url TEXT,
  zip_url TEXT,
  audio_urls JSONB,
  extra_files JSONB,
  
  max_poang_total INTEGER,
  antal_delprov INTEGER DEFAULT 1,
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE delprov (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prov_id UUID NOT NULL REFERENCES prov(id) ON DELETE CASCADE,
  
  beteckning TEXT NOT NULL,
  titel TEXT,
  beskrivning TEXT,
  
  max_poang INTEGER,
  tid_minuter INTEGER,
  ordning INTEGER,
  
  pdf_url TEXT,
  audio_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fraga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delprov_id UUID NOT NULL REFERENCES delprov(id) ON DELETE CASCADE,
  
  fraga_nummer TEXT NOT NULL,
  typ fraga_typ NOT NULL,
  
  text TEXT NOT NULL,
  bild_url TEXT,
  tabell_json JSONB,
  
  svarsalternativ_json JSONB,
  korrekt_svar TEXT,
  
  max_poang INTEGER DEFAULT 1,
  svarstyp TEXT,
  
  svarighetsgrad NUMERIC(3,2),
  vanliga_missforstand TEXT,
  varfor_viktig TEXT,
  
  historiska_varianter JSONB,
  
  kalla TEXT,
  last_updated TIMESTAMPTZ DEFAULT now(),
  human_reviewed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE kunskapsmal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kod TEXT UNIQUE NOT NULL,
  kurs TEXT NOT NULL,
  beskrivning TEXT NOT NULL,
  
  lgr22_gy25_referens TEXT,
  amne prov_amn,
  arskurs_kurs TEXT,
  
  foralder_id UUID REFERENCES kunskapsmal(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fraga_kunskapsmal (
  fraga_id UUID REFERENCES fraga(id) ON DELETE CASCADE,
  kunskapsmal_id UUID REFERENCES kunskapsmal(id) ON DELETE CASCADE,
  PRIMARY KEY (fraga_id, kunskapsmal_id),
  
  styrka NUMERIC(3,2) DEFAULT 1.0,
  kommentar TEXT,
  
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- COMMUNITY & PREDICTIVE
-- =====================================================

CREATE TABLE community_forklaring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraga_id UUID NOT NULL REFERENCES fraga(id) ON DELETE CASCADE,
  
  text TEXT NOT NULL,
  forfattare TEXT,
  forfattare_roll TEXT,
  
  status forklaring_status DEFAULT 'pending',
  upvotes INTEGER DEFAULT 0,
  
  moderated_by TEXT,
  moderated_at TIMESTAMPTZ,
  moderation_note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE anvandare (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  namn TEXT,
  roll TEXT DEFAULT 'besokare',
  verified_larare BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trend_analys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amne prov_amn,
  arskurs_kurs TEXT,
  ar INTEGER,
  
  medelresultat NUMERIC(5,2),
  andel_godkant NUMERIC(5,2),
  svarighetsindex NUMERIC(5,2),
  
  forvantad_svarighet_gy25 TEXT,
  trend_kommentar TEXT,
  
  kalla TEXT DEFAULT 'Skolverket + intern analys',
  kalla_url TEXT,
  
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES & SEARCH
-- =====================================================
CREATE INDEX idx_prov_amne_ar ON prov(amne, ar DESC);
CREATE INDEX idx_prov_slug ON prov(slug);
CREATE INDEX idx_fraga_delprov ON fraga(delprov_id);
CREATE INDEX idx_fraga_kunskapsmal ON fraga_kunskapsmal(kunskapsmal_id);

ALTER TABLE fraga ADD COLUMN search_vector tsvector 
  GENERATED ALWAYS AS (to_tsvector('swedish', coalesce(text, '') || ' ' || coalesce(vanliga_missforstand, ''))) STORED;
CREATE INDEX idx_fraga_search ON fraga USING GIN (search_vector);

-- =====================================================
-- TRIGGERS
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
-- VIEWS
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

COMMENT ON TABLE prov IS 'Huvudentitet för nationella prov och relaterade material. Stark provenance.';
COMMENT ON TABLE kunskapsmal IS 'Central tabell för NP Question Genome Project.';
COMMENT ON TABLE fraga IS 'Atomär fråga. Värdefullast för elever, lärare och AI-agenter.';

-- End of initial schema migration
