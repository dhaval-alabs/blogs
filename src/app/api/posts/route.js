import { NextResponse } from 'next/server';
import { searchPosts, searchPostsLite } from '@/lib/data.server';
import { getServiceClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query  = searchParams.get('q')      ?? '';
  const topic  = searchParams.get('topic')  ?? null;
  const skill  = searchParams.get('skill')  ?? null;
  const all    = searchParams.get('all')    === 'true'; // studio: return all statuses

  if (all) {
    // Studio-only: requires an authenticated session
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // return every post regardless of status, newest first
    const db = getServiceClient();
    const { data, error } = await db
      .from('posts')
      .select('id,title,slug,status,category,image,alt_text,published_at,updated_at,read_time,author_id,domain_tags,skill_level,excerpt,content,seo,course_mappings,course_cta,newsletter,quiz,ai_hints,trust,discussion,advanced')
      .order('id', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Map snake_case → camelCase for the client
    const fmtDate = (d) => {
      if (!d) return '';
      try { const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; }
    };
    const posts = (data || []).map(r => ({
      ...r,
      readTime: r.read_time,
      authorId: r.author_id,
      publishedAt: fmtDate(r.published_at),
      updatedAt: fmtDate(r.updated_at),
      altText: r.alt_text,
    }));
    return NextResponse.json(posts);
  }

  // Public listing — use the lightweight projection (no content column).
  const posts = await searchPostsLite(query, topic, skill);
  return NextResponse.json(posts);
}
