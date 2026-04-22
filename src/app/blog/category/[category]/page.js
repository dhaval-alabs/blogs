"use client";

import { useParams } from "next/navigation";
import CategoryView from "@/components/CategoryView";

export default function CategoryPage() {
  const params = useParams();
  return <CategoryView categorySlug={params.category || ""} />;
}
