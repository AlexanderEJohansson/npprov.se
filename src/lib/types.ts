// =====================================================
// npprov.se TypeScript Types
// Generated from db/schema.sql + practical needs
// =====================================================

export type ProvAmne = 
  | 'Matematik' | 'Svenska' | 'Svenska som andraspråk' | 'Engelska'
  | 'Biologi' | 'Fysik' | 'Kemi' | 'Historia' | 'Geografi'
  | 'Samhällskunskap' | 'Religionskunskap' | 'Moderna språk';

export type ProvArskurs = 'ak3' | 'ak6' | 'ak9' | 'gy';

export type ProvTyp = 
  | 'hela' | 'delprov' | 'exempel' | 'bedomningsunderlag' 
  | 'bedomningsanvisningar' | 'lararinformation' | 'ovrigt';

export interface Prov {
  id: string;
  slug: string;
  
  ar: number;
  termin?: string | null;
  amne: ProvAmne;
  arskurs_kurs: ProvArskurs;
  typ: ProvTyp;
  
  titel: string;
  beskrivning?: string;
  
  // Provenance (extremt viktigt för AEO / auktoritet)
  kalla: string;
  kalla_url?: string;
  publicerad_datum?: string;
  last_updated: string;
  human_reviewed: boolean;
  
  pdf_url?: string;
  zip_url?: string;
  audio_urls?: string[];
  
  max_poang_total?: number;
  metadata?: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

export interface Delprov {
  id: string;
  prov_id: string;
  beteckning: string;
  titel?: string;
  beskrivning?: string;
  max_poang?: number;
  tid_minuter?: number;
  ordning?: number;
  pdf_url?: string;
}

export interface Fraga {
  id: string;
  delprov_id: string;
  fraga_nummer: string;
  typ: string;
  text: string;
  bild_url?: string;
  svarsalternativ_json?: any;
  korrekt_svar?: string;
  max_poang?: number;
  svarighetsgrad?: number;
  vanliga_missforstand?: string;
  varfor_viktig?: string;
  historiska_varianter?: any;
  kunskapsmal?: Kunskapsmal[]; // Populated via join
}

export interface Kunskapsmal {
  id: string;
  kod: string;
  kurs: string;
  beskrivning: string;
  lgr22_gy25_referens?: string;
  amne?: ProvAmne;
}

export interface CommunityForklaring {
  id: string;
  fraga_id: string;
  text: string;
  forfattare?: string;
  forfattare_roll?: string;
  status: 'pending' | 'approved' | 'rejected';
  upvotes: number;
  created_at: string;
}

// Seed / Legacy data shape (from old manifest)
export interface LegacyManifestItem {
  id: string;
  title: string;
  subject: string;
  level: string;
  year?: number;
  term?: string | null;
  type: string;
  original_filename: string;
  files?: Array<{
    name: string;
    local_path?: string | null;
    size_bytes?: number;
  }>;
  source_url?: string;
  source_note?: string;
  public?: boolean;
}
