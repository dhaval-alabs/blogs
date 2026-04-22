import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

/**
 * Public: returns the /blog page config (featured posts + carousels).
 * Read-only endpoint — mutations go through updateBlogPageConfigAction.
 */
export async function GET() {
  try {
    const db = getServiceClient();
    const { data } = await db
      .from("site_config")
      .select("zones")
      .eq("key", "global")
      .maybeSingle();

    const bp = data?.zones?.blog_page || {};
    const cw = bp.categories_widget || {};
    return NextResponse.json({
      featured_slugs: Array.isArray(bp.featured_slugs) ? bp.featured_slugs : [],
      carousels:      Array.isArray(bp.carousels) ? bp.carousels : [],
      categories_widget: {
        enabled:    cw.enabled !== false,
        title:      typeof cw.title === 'string' ? cw.title : 'Categories',
        mode:       cw.mode === 'manual' ? 'manual' : 'auto',
        limit:      Number.isFinite(cw.limit) ? cw.limit : 12,
        categories: Array.isArray(cw.categories) ? cw.categories : [],
      },
    });
  } catch {
    return NextResponse.json({
      featured_slugs: [],
      carousels: [],
      categories_widget: { enabled: true, title: 'Categories', mode: 'auto', limit: 12, categories: [] },
    });
  }
}
