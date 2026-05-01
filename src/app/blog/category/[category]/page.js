import { getCategoryPosts, isCategorySlug } from "@/lib/data.server";
import { notFound } from "next/navigation";
import CategoryView from "@/components/CategoryView";
import { SITE_NAME } from "@/lib/config";

export async function generateMetadata({ params }) {
  const { category } = await params;
  const label = category.replace(/-/g, " ");
  return {
    title: `${label.replace(/\b\w/g, (c) => c.toUpperCase())} | ${SITE_NAME}`,
    description: `Articles in ${label}`,
    alternates: { canonical: `https://www.analytixlabs.co.in/blog/category/${category}/` },
  };
}

export default async function CategoryPage({ params }) {
  const { category } = await params;
  
  if (!(await isCategorySlug(category))) {
    notFound();
  }

  const initialPosts = await getCategoryPosts(category);
  return <CategoryView categorySlug={category} initialPosts={initialPosts} />;
}
