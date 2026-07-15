/**
 * Deep links to NP-Monstret practice modules.
 * Based on public CURRICULUM-ALIGNMENT.md (np-monstret-public).
 * Falls back to subject guide pages when no exact kod mapping exists.
 */

const KM_PATHS: Record<string, string> = {
  'MA9.1.1': '/np/matte-ak9/problemlosning',
  'MA9.2.1': '/np/matte-ak9/tal-algebra',
  'MA9.3.1': '/np/matte-ak9/geometri',
  'MA9.4.1': '/np/matte-ak9/sannolikhet-statistik',
  'SV9.1.1': '/np/svenska-ak9/lasforstaelse',
  'SV9.2.1': '/np/svenska-ak9/skrivande',
  'SV9.3.1': '/np/svenska-ak9/muntligt',
  'EN9.1.1': '/np/engelska-ak9/reception',
  'EN9.2.1': '/np/engelska-ak9/produktion',
  'BI9.1.1': '/np/no-ak9/biologi',
  'FY9.1.1': '/np/no-ak9/fysik',
  'KE9.1.1': '/np/no-ak9/kemi',
  'HI9.1.1': '/np/so-ak9/historia',
  'RE9.1.1': '/np/so-ak9/religion',
  'SA9.1.1': '/np/so-ak9/samhallskunskap',
  'GEO9.1.1': '/np/so-ak9/geografi',
  'GEO9.2.1': '/np/so-ak9/geografi',
  'GEO9.3.1': '/np/so-ak9/geografi',
};

const SUBJECT_GUIDES: Record<string, string> = {
  Matematik: '/guide/np-matematik-ak9-guide',
  Svenska: '/guide/np-svenska-ak9-guide',
  Engelska: '/guide/np-engelska-ak9-guide',
  Biologi: '/guide/np-no-ak9-guide',
  Fysik: '/guide/np-no-ak9-guide',
  Kemi: '/guide/np-no-ak9-guide',
  Historia: '/guide/np-so-ak9-guide',
  Religionskunskap: '/guide/np-so-ak9-guide',
  Samhällskunskap: '/guide/np-so-ak9-guide',
  Geografi: '/guide/np-so-ak9-guide',
};

const PREFIX_FALLBACK: Record<string, string> = {
  MA: '/np/matte-ak9/problemlosning',
  SV: '/np/svenska-ak9/lasforstaelse',
  EN: '/np/engelska-ak9/reception',
  BI: '/np/no-ak9/biologi',
  FY: '/np/no-ak9/fysik',
  KE: '/np/no-ak9/kemi',
  HI: '/np/so-ak9/historia',
  RE: '/np/so-ak9/religion',
  SA: '/np/so-ak9/samhallskunskap',
  GEO: '/np/so-ak9/geografi',
};

export function npmonstretUrlForKod(kod: string | null | undefined, amne?: string | null): string {
  if (!kod) {
    const guide = amne ? SUBJECT_GUIDES[amne] : null;
    return `https://npmonstret.se${guide || ''}`;
  }

  if (KM_PATHS[kod]) {
    return `https://npmonstret.se${KM_PATHS[kod]}`;
  }

  const prefix = kod.replace(/\d.*/, '');
  if (PREFIX_FALLBACK[prefix]) {
    return `https://npmonstret.se${PREFIX_FALLBACK[prefix]}`;
  }

  const guide = amne ? SUBJECT_GUIDES[amne] : null;
  return `https://npmonstret.se${guide || ''}`;
}

export function npmonstretLabelForKod(kod: string): string {
  return `Öva på ${kod} i NP-Monstret`;
}