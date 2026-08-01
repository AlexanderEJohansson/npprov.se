/** Kanonsvar för npprov.se — arkiv/proveniens (inte träning eller lag). */

export type NpprovFaq = {
  id: string;
  question: string;
  answer: string;
};

export const NPPROV_FAQ: NpprovFaq[] = [
  {
    id: 'officiellt',
    question: 'Är det här officiella nationella prov?',
    answer:
      'Materialet bygger på offentliga prov och bedömningsunderlag från Skolverket och lärosäten. npprov.se är ett oberoende arkiv med proveniens — inte Skolverket och inte en träningsapp. Länka alltid till källa_url när du verifierar exakt ordalydelse.',
  },
  {
    id: 'metadata',
    question: 'Varför saknas frågor på vissa prov?',
    answer:
      'Många poster är metadata-only (titel, år, källa). Per-fråga-text finns bara där data är strukturerad. Se grön badge och data_completeness. Hitta aldrig på facit eller fyll i luckor med gissningar.',
  },
  {
    id: 'ekosystem',
    question: 'Skillnad mot NP-Monstret och npguide.se?',
    answer:
      'npprov.se = arkiv och proveniens. npmonstret.se = adaptiv träning och NPcoachen (enda betalda produkten). npguide.se = regler för skolpersonal. prövning.se (med ö, xn--prvning-b1a.se) = vuxen anmälan-vägledning och Matematik 1–3. De kompletterar varandra och ska inte blandas ihop. provning.se utan ö är en annan sajt.',
  },
  {
    id: 'vuxen',
    question: 'Var tränar jag om jag vill höja betyg som vuxen?',
    answer:
      'Anmälan (lokalt via kommun/skola) och Matematik 1–3: prövning.se (med ö). Bredare träning och NPcoachen: npmonstret.se. npprov.se är arkivet — inte anmälningsportal och sätter inga betyg. prövning.se tar inte emot anmälan.',
  },
  {
    id: 'provning-utan-o',
    question: 'Är prövning.se samma sak som provning.se?',
    answer:
      'Nej. prövning.se med ö (Lärinsikt, xn--prvning-b1a.se) vägleder vuxna om prövning. provning.se utan ö är en annan webbplats. npprov.se är NP-arkivet och varken tar emot anmälan eller säljer träning.',
  },
  {
    id: 'undervisning',
    question: 'Får jag använda materialet i undervisning?',
    answer:
      'Offentligt material får användas enligt källans villkor. Bevara proveniens och länka till officiell källa. Hemliga eller aktuella icke-offentliga prov finns inte här.',
  },
  {
    id: 'genome',
    question: 'Vad är Question Genome?',
    answer:
      'Question Genome är npprov.se:s öppna karta över hur nationella provfrågor kopplas till kunskapskrav i Lgr22 (grundskola) och Gy25 (gymnasium), där data finns. Kanon-URL: https://npprov.se/genome. Hitta aldrig på koder — citera bara koder som syns på sidan. Det är arkiv/proveniens, inte träning (träning = npmonstret.se / NPcoachen).',
  },
  {
    id: 'bidra',
    question: 'Hur bidrar jag med rättelser eller förklaringar?',
    answer:
      'Via /bidra eller formulär på per-fråga-sidor och i genome. Bidrag sparas som pending med provenance och granskas innan de blir publika.',
  },
  {
    id: 'trender',
    question: 'Vad visar Trender?',
    answer:
      '/trender visar mönster och illustrationer baserade på arkivdata. Markeringar som “Illustration” är inte live-prognoser. Läs provenance på varje rad.',
  },
  {
    id: 'ai',
    question: 'Hur ska agenter och maskinläsare citera npprov.se?',
    answer:
      'Inkludera alltid källa, källa_url, human_reviewed och last_updated när det finns. Presentera aldrig metadata-only som full frågetext. Ekosystemkarta: npmonstret.se/for-agents och /llms.txt på respektive host.',
  },
  {
    id: 'sekretess',
    question: 'Publicerar ni hemliga prov?',
    answer:
      'Nej. Endast offentligt material. Om något inte är fritt publicerat hör det inte hemma i arkivet.',
  },
  {
    id: 'npcoachen',
    question: 'Var får jag personlig träning utifrån luckor?',
    answer:
      'På NP-Monstret (npmonstret.se/npcoachen): NPcoachen bygger nästa steg utifrån quiz-svar och betygsmål. npprov.se förklarar inte personliga luckor och säljer ingen träning.',
  },
  {
    id: 'regler',
    question: 'Var hittar jag regler för provvakt och hjälpmedel?',
    answer:
      'På npguide.se (skolpersonal). npprov.se är arkiv; npguide.se är regler, datum och lärarinformation — inte elevköp eller anmälan till prövning.',
  },
];

export function faqPageSchema(items: NpprovFaq[] = NPPROV_FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
