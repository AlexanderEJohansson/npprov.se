import { npmonstretLabelForKod, npmonstretUrlForKod } from './npmonstret-links';

export interface EcosystemLinkProps {
  context: 'prov' | 'fraga';
  amne?: string | null;
  arskurs?: string | null;
  hasGranularData?: boolean;
  hasKunskapsmal?: boolean;
  questionText?: string | null;
  kunskapsmalKoder?: string[];
}

export function mentionsHjalpmedel(text: string | null | undefined): boolean {
  if (!text) return false;
  return /digitala?\s+verktyg|kalkylator|räknare|miniräknare|hjälpmedel|formelblad|tillåtna|förbjudna/i.test(
    text
  );
}

export function isGymnasieNiva(arskurs: string | null | undefined, amne?: string | null): boolean {
  if (arskurs === 'gy') return true;
  if (!amne) return false;
  return /gymnas|ma\s*[2-5]|gy25/i.test(amne);
}

/** When to show NP-Monstret link */
export function showNpmonstret(props: EcosystemLinkProps): boolean {
  if (props.context === 'prov') return !!props.hasGranularData;
  if (props.context === 'fraga') return !!props.hasKunskapsmal;
  return false;
}

/** Resolve contextual NP-guide URL, or null if not relevant */
export function npguideUrl(props: EcosystemLinkProps): string | null {
  if (props.context === 'fraga') {
    if (mentionsHjalpmedel(props.questionText)) {
      return 'https://npguide.se/skolpersonal/hjalpmedel-tillatna-och-forbjudna';
    }
    return null;
  }

  if (isGymnasieNiva(props.arskurs, props.amne)) {
    return 'https://npguide.se/skolpersonal/gymnasiet';
  }

  return 'https://npguide.se/skolpersonal/lararinformation';
}

export function npguideLabel(url: string): string {
  if (url.includes('hjalpmedel')) return 'hjälpmedel vid nationella prov';
  if (url.includes('gymnasiet')) return 'regler för gymnasiet';
  return 'lärarinformation och delprov';
}

/** UTM: utm_source=npprov&utm_medium=ecosystem&utm_campaign={page} */
function withEcosystemUtm(url: string, campaign: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'npprov');
    u.searchParams.set('utm_medium', 'ecosystem');
    u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}utm_source=npprov&utm_medium=ecosystem&utm_campaign=${encodeURIComponent(campaign)}`;
  }
}

export function npmonstretLink(
  props: EcosystemLinkProps
): { url: string; label: string } | null {
  if (!showNpmonstret(props)) return null;

  const campaign = props.context === 'fraga' ? 'fraga' : 'prov';
  const kod = props.kunskapsmalKoder?.[0];
  if (kod) {
    return {
      url: withEcosystemUtm(npmonstretUrlForKod(kod, props.amne), campaign),
      label: npmonstretLabelForKod(kod),
    };
  }

  return {
    url: withEcosystemUtm(npmonstretUrlForKod(null, props.amne), campaign),
    label: 'Öva liknande uppgifter i NP-Monstret',
  };
}