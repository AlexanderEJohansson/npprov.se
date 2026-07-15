import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase';

// Simple server-side contribution handler.
// Uses service role to insert as 'pending' (bypasses client RLS).
// This allows public visitors to propose without requiring login (no walls).
// All inserts get full provenance (kalla/forfattare + created_at).

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  console.log('API /api/contribute POST called, method:', request.method);
  try {
    const data = await request.json();

    const fragaRef = (data.fragaRef || '').trim();
    const typ = (data.typ || 'Annan förbättring').trim();
    const text = (data.text || '').trim();
    const roll = (data.roll || 'Lärare / sakkunnig').trim();

    if (!text || text.length < 10) {
      return new Response(JSON.stringify({ success: false, error: 'Texten är för kort. Beskriv ditt förslag tydligare.' }), { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) {
      return new Response(JSON.stringify({ success: false, error: 'Database not configured' }), { status: 503 });
    }

    let fragaId: string | null = null;

    // Best-effort lookup: if user gave something that looks like a UUID, use it directly.
    // Otherwise try to match against known prov slug or fraga reference (limited).
    if (/^[0-9a-fA-F-]{36}$/.test(fragaRef)) {
      fragaId = fragaRef;
    } else if (fragaRef) {
      // Try to find a matching fraga by slug in the reference string (e.g. "ma-ak9-2024 fraga 3")
      const { data: matches } = await supabase
        .from('fraga')
        .select('id, delprov:delprov_id(prov:prov_id(slug))')
        .limit(5);

      if (matches && matches.length > 0) {
        const lowerRef = fragaRef.toLowerCase();
        const found = matches.find((f: any) => {
          const slug = f.delprov?.prov?.slug || '';
          return lowerRef.includes(slug) || lowerRef.includes(f.id);
        });
        if (found) fragaId = found.id;
      }
    }

    const proposalText = `${typ}: ${text}\n\nReferens: ${fragaRef || 'allmän'}`;

    const { error } = await supabase
      .from('community_forklaring')
      .insert({
        fraga_id: fragaId,
        text: proposalText,
        forfattare: roll,
        forfattare_roll: roll.includes('Lärare') ? 'lärare' : 'sakkunnig',
        status: 'pending',
      });

    if (error) {
      console.error('Contribution insert error:', error);
      return new Response(JSON.stringify({ success: false, error: 'Kunde inte spara just nu. Försök igen eller maila.' }), { status: 500 });
    }

    // För "Koppling till kunskapsmål": försök skapa direkt junction om vi kan tolka en kod och har fraga
    if (typ.toLowerCase().includes('koppling') && fragaId) {
      const kodMatch = text.match(/[A-ZÅÄÖ]{2,}\d+\.\d+\.\d+/i);
      if (kodMatch) {
        const kod = kodMatch[0].toUpperCase();
        const { data: km } = await supabase.from('kunskapsmal').select('id').eq('kod', kod).limit(1).single();
        if (km?.id) {
          await supabase.from('fraga_kunskapsmal').insert({
            fraga_id: fragaId,
            kunskapsmal_id: km.id,
            styrka: 0.75,
            kommentar: `Föreslagen via bidrag: ${text.slice(0, 120)}`,
            added_by: roll,
          }).catch(() => {}); // ignore duplicate
        }
      }
    }

    // För trend-relaterade bidrag loggas de i community_forklaring och kan användas manuellt för att uppdatera trend_analys
    return new Response(JSON.stringify({
      success: true,
      message: 'Tack! Ditt bidrag är registrerat med status "pending" och kommer att granskas. Kopplingar skapas ofta direkt vid "koppling"-typ. Godkända bidrag syns i per-fråga /genome och kan ligga till grund för trend_analys-uppdateringar.'
    }), { status: 200 });

  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: 'Oväntat fel. ' + (e?.message || '') }), { status: 500 });
  }
};
