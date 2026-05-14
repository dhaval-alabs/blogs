import { requireSuperAdmin } from '@/lib/infrastructure/auth';
import { revalidateRoute } from '@/lib/utils/core';

export async function createCourse({ title, label, description, image, url, duration, rating, domain_tags }) {
  try {
    const db = await requireSuperAdmin();
    const { data: last } = await db
      .from('courses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (last?.sort_order ?? -1) + 1;

    const { data, error } = await db.from('courses').insert({
      title,
      label: label || '',
      description: description || '',
      image: image || '',
      url: url || '#',
      duration: duration || '',
      rating: parseFloat(rating) || 4.5,
      domain_tags: Array.isArray(domain_tags) ? domain_tags : [],
      sort_order: nextOrder,
      is_active: true,
    }).select().single();

    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true, course: data };
  } catch (error) {
    console.error('createCourse failed:', error);
    return { success: false, error: error.message || 'Failed to create course.' };
  }
}

export async function updateCourse(id, { title, label, description, image, url, duration, rating, domain_tags }) {
  try {
    const db = await requireSuperAdmin();
    const { error } = await db.from('courses').update({
      title,
      label: label || '',
      description: description || '',
      image: image || '',
      url: url || '#',
      duration: duration || '',
      rating: parseFloat(rating) || 4.5,
      domain_tags: Array.isArray(domain_tags) ? domain_tags : [],
    }).eq('id', id);

    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true };
  } catch (error) {
    console.error('updateCourse failed:', error);
    return { success: false, error: error.message || 'Failed to update course.' };
  }
}

export async function deleteCourse(id) {
  try {
    const db = await requireSuperAdmin();
    const { error } = await db.from('courses').delete().eq('id', id);
    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true };
  } catch (error) {
    console.error('deleteCourse failed:', error);
    return { success: false, error: error.message || 'Failed to delete course.' };
  }
}
