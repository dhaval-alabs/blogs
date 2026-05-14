import { getServiceClient } from '@/lib/supabase';
import { getCallerSlug } from '@/lib/infrastructure/auth';

export async function subscribe({ email, name = '', source = 'newsletter' }) {
  try {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { success: false, error: 'A valid email is required.' };
    }

    const db = getServiceClient();

    const { error } = await db.from('subscribers').upsert(
      { email: email.trim().toLowerCase(), name: name.trim(), source },
      { onConflict: 'email', ignoreDuplicates: true }
    );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('subscribe failed:', error);
    if (error.code === '23505') return { success: true };
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function fetchSubscribers() {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { data, error } = await db
      .from('subscribers')
      .select('id, email, name, source, subscribed_at, is_active')
      .order('subscribed_at', { ascending: false });

    if (error) throw error;
    return { success: true, subscribers: data || [] };
  } catch (error) {
    console.error('fetchSubscribers failed:', error);
    return { success: false, error: 'Failed to fetch subscribers.' };
  }
}

export async function toggleSubscriber(id, isActive) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db
      .from('subscribers')
      .update({ is_active: !!isActive })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('toggleSubscriber failed:', error);
    return { success: false, error: 'Failed to update subscriber.' };
  }
}

export async function deleteSubscriber(id) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db.from('subscribers').delete().eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('deleteSubscriber failed:', error);
    return { success: false, error: 'Failed to delete subscriber.' };
  }
}
