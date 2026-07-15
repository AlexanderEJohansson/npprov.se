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

export function npmonstretLink(
  props: EcosystemLinkProps
): { url: string; label: string } | null {
  if (!showNpmonstret(props)) return null;

  const kod = props.kunskapsmalKoder?.[0];
  if (kod) {
    return {
      url: npmonstretUrlForKod(kod, props.amne),
      label: npmonstretLabelForKod(kod),
    };
  }

  return {
    url: npmonstretUrlForKod(null, props.amne),
    label: 'Öva liknande uppgifter i NP-Monstret',
  };
}