import { NextResponse } from 'next/server';
import { searchPosts, searchPostsLite } from '@/lib/data.server';
import { getServiceClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

// Cache public listing for 5 minutes — studio requests bypass via ?all=true
export const revalidate = 300;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query  = searchParams.get('q')      ?? '';
  const topic  = searchParams.get('topic')  ?? null;
  const skill  = searchParams.get('skill')  ?? null;
  const all    = searchParams.get('all')    === 'true'; // studio: return all statuses

  if (all) {
    // Studio-only: authenticated session required.
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the caller's author row so we can scope the query by role.
    // Super admins see every post; regular authors see only their own.
    // Previously this endpoint returned every post to any logged-in user,
    // which leaked draft content from other authors.
    const db = getServiceClient();
    const { data: caller } = await db
      .from('authors')
      .select('slug, is_super_admin')
      .ilike('email', user.email)
      .maybeSingle();

    if (!caller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = db
      .from('posts')
      .select('id,title,slug,status,category,image,alt_text,published_at,read_time,author_id,domain_tags,skill_level,excerpt,content,seo,course_mappings,course_cta,newsletter,quiz,ai_hints,trust,discussion,advanced')
      .order('id', { ascending: false });

    if (!caller.is_super_admin) {
      query = query.eq('author_id', caller.slug);
    }

    const { data, error } = await query;
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
      altText: r.alt_text,
    }));
    return NextResponse.json(posts);
  }

  // Public listing — use the lightweight projection (no content column).
  const posts = await searchPostsLite(query, topic, skill);
  return NextResponse.json(posts);
}
