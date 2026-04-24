"use client";

import { useSearchParams } from "next/navigation";

export default function ThankYouClient() {
  const params = useSearchParams();
  const name = (params.get("name") || "").trim();
  const firstName = name.split(" ")[0];

  return firstName ? `Thank you, ${firstName}!` : "Thank you for reaching out!";
}
