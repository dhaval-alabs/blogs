import { getServiceClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export async function getCallerSlug() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Unauthorized');

  const db = getServiceClient();
  const { data: author } = await db
    .from('authors')
    .select('slug, is_super_admin')
    .ilike('email', user.email)
    .maybeSingle();

  return {
    slug: author?.slug || null,
    isSuperAdmin: author?.is_super_admin === true
  };
}

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return getServiceClient();
}

export async function requireSuperAdmin() {
  const { isSuperAdmin } = await getCallerSlug();
  if (!isSuperAdmin) throw new Error('Forbidden');
  return getServiceClient();
}
