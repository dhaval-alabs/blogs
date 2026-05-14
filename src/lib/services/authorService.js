import { getServiceClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { getCallerSlug, requireSuperAdmin } from '@/lib/infrastructure/auth';
import { toSlug } from '@/lib/utils/core';

export async function adminCreateUser({
  email, name, password, role,
  bio = '', linkedin = '', experience = '', expertise = '', image = '', position = ''
}) {
  try {
    if (!email || !password || !name) {
      return { success: false, error: 'Email, name, and password are required.' };
    }

    const supabaseSession = await createClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
    if (authErr || !user) return { success: false, error: 'Unauthorized: Not logged in.' };

    const db = getServiceClient();
    const { data: requestor, error: reqErr } = await db
      .from('authors')
      .select('is_super_admin')
      .ilike('email', user.email)
      .maybeSingle();

    if (reqErr || !requestor?.is_super_admin) {
      return { success: false, error: 'Forbidden: You must be a Super Admin to perform this action.' };
    }

    const { error: createUserErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createUserErr) {
      const alreadyExists =
        createUserErr.message?.toLowerCase().includes('already') ||
        createUserErr.message?.toLowerCase().includes('registered') ||
        createUserErr.code === 'email_exists' ||
        createUserErr.code === 'user_already_exists' ||
        createUserErr.status === 422;
      if (!alreadyExists) throw createUserErr;
    }

    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();
    const isSuperAdmin = role === 'admin';

    const { data: existingAuthor } = await db
      .from('authors')
      .select('slug, is_super_admin')
      .eq('email', normalizedEmail)
      .maybeSingle();

    const finalIsSuperAdmin = existingAuthor?.is_super_admin ? true : isSuperAdmin;
    const slug = existingAuthor?.slug || (toSlug(name) + '-' + Math.floor(Math.random() * 1000));

    const row = {
      slug,
      name,
      email: normalizedEmail,
      is_super_admin: finalIsSuperAdmin,
      initials,
      color: '#0f2554',
      bio,
      linkedin,
      experience,
      expertise: expertise.split(',').map(t => t.trim()).filter(Boolean),
      image,
      position
    };

    let dbErr;
    if (existingAuthor) {
      const { error } = await db.from('authors').update(row).eq('slug', existingAuthor.slug);
      dbErr = error;
    } else {
      const { error } = await db.from('authors').insert(row);
      dbErr = error;
    }

    if (dbErr) throw dbErr;
    return { success: true };
  } catch (error) {
    console.error('adminCreateUser failed:', error);
    const msg = error?.message || '';
    if (msg.toLowerCase().includes('password')) return { success: false, error: 'Password too weak (min 6 characters).' };
    if (msg.toLowerCase().includes('email')) return { success: false, error: 'Invalid or already-registered email.' };
    return { success: false, error: 'Failed to create user. Please try again.' };
  }
}

export async function updateAuthorProfile({ name, bio, linkedin, experience, expertise, image, position }) {
  try {
    const supabaseSession = await createClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
    if (authErr || !user) return { success: false, error: 'Unauthorized: Not logged in.' };

    const db = getServiceClient();
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    const { error } = await db
      .from('authors')
      .update({
        name,
        initials,
        bio,
        linkedin,
        experience,
        expertise: (expertise || '').split(',').map(t => t.trim()).filter(Boolean),
        image,
        position,
      })
      .ilike('email', user.email);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('updateAuthorProfile failed:', error);
    return { success: false, error: 'Failed to update profile. Please try again.' };
  }
}

export async function toggleSuperAdmin(targetSlug, makeSuperAdmin) {
  try {
    const db = await requireSuperAdmin();

    if (makeSuperAdmin === false) {
      const { data: admins } = await db.from('authors').select('slug').eq('is_super_admin', true);
      if (admins && admins.length <= 1 && admins[0]?.slug === targetSlug) {
        return { success: false, error: 'Cannot remove the last super admin.' };
      }
    }

    const { data, error } = await db
      .from('authors')
      .update({ is_super_admin: !!makeSuperAdmin })
      .eq('slug', targetSlug)
      .select('slug, name, is_super_admin')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, author: data };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to toggle super admin.' };
  }
}

export async function fetchAllAuthors() {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { data, error } = await db
      .from('authors')
      .select('name, slug, email, image, initials')
      .order('name');

    if (error) throw error;
    return { success: true, authors: data };
  } catch (error) {
    console.error('fetchAllAuthors failed:', error);
    return { success: false, error: error.message || 'Failed to fetch authors.' };
  }
}
