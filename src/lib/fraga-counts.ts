import type { SupabaseClient } from '@supabase/supabase-js';

export type FragaCountMap = Record<string, number>;
export type FacitCountMap = Record<string, number>;

export async function getFragaCountsByProvId(
  supabase: SupabaseClient
): Promise<FragaCountMap> {
  const counts: FragaCountMap = {};
  try {
    const { data } = await supabase
      .from('fraga')
      .select('id, delprov:delprov_id(prov_id)');

    if (data) {
      for (const row of data) {
        const provId = (row as { delprov?: { prov_id?: string } }).delprov?.prov_id;
        if (provId) {
          counts[provId] = (counts[provId] || 0) + 1;
        }
      }
    }
  } catch (_) {
    // graceful – pages work without counts
  }
  return counts;
}

export function getFragaCount(
  item: { id?: string },
  counts: FragaCountMap
): number {
  return item.id ? counts[item.id] || 0 : 0;
}

export async function getFacitCountsByProvId(
  supabase: SupabaseClient
): Promise<FacitCountMap> {
  const counts: FacitCountMap = {};
  try {
    const { data } = await supabase
      .from('fraga')
      .select('id, korrekt_svar, delprov:delprov_id(prov_id)')
      .not('korrekt_svar', 'is', null);

    if (data) {
      for (const row of data) {
        const provId = (row as { delprov?: { prov_id?: string } }).delprov?.prov_id;
        if (provId && row.korrekt_svar) {
          counts[provId] = (counts[provId] || 0) + 1;
        }
      }
    }
  } catch (_) {}
  return counts;
}

export function getFacitCount(
  item: { id?: string },
  counts: FacitCountMap
): number {
  return item.id ? counts[item.id] || 0 : 0;
}

export function sortByFragaCount<T extends { id?: string }>(
  items: T[],
  counts: FragaCountMap
): T[] {
  return [...items].sort(
    (a, b) => getFragaCount(b, counts) - getFragaCount(a, counts)
  );
}