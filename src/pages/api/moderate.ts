import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase';

// Internal moderation API.
// Protected by MODERATOR_SECRET (set in env) or by not linking the /moderera page publicly.
// All updates go through service role for full control (bypasses normal RLS).

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.MODERATOR_SECRET;
  const provided = request.headers.get('x-moderator-secret') || '';

  if (secret && provided !== secret) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, moderation_note, moderated_by } = body;

    if (!id || !status) {
      return new Response(JSON.stringify({ success: false, error: 'id and status required' }), { status: 400 });
    }

    const allowed = ['approved', 'rejected', 'needs_revision'];
    if (!allowed.includes(status)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid status' }), { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) {
      return new Response(JSON.stringify({ success: false, error: 'Database not configured' }), { status: 503 });
    }

    const { data: updated, error } = await supabase
      .from('community_forklaring')
      .update({
        status,
        moderation_note: moderation_note || null,
        moderated_by: moderated_by || 'moderator',
        moderated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status');

    if (error) {
      console.error('Moderate error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }

    if (!updated || updated.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bidrag hittades inte (ogiltigt id)' }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: updated[0].status }),
      { status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Bad request' }), { status: 400 });
  }
};
