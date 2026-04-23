"use client";

import Link from "next/link";
import { MOBILE_NAV_ITEMS } from "@/lib/config";

export default function MobileBottomNav({ activePage = "home" }) {
  return (
    <nav className="mobile-bottom-nav">
      {MOBILE_NAV_ITEMS.map((item) => {
        const isAnchor = item.href?.startsWith("#");
        const isExternal = item.href?.startsWith("http");
        const className = `mobile-nav-item ${item.id === activePage ? "active" : ""}`;
        const content = (
          <>
            <span
              className={`material-symbols-outlined text-xl ${
                item.id === activePage ? "filled" : ""
              }`}
            >
              {item.icon}
            </span>
            {item.label}
          </>
        );

        if (isAnchor) {
          return (
            <a
              key={item.id}
              href={item.href}
              className={className}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(item.href.substring(1));
                if (el) {
                  const offset = 80;
                  const bodyRect = document.body.getBoundingClientRect().top;
                  const elementRect = el.getBoundingClientRect().top;
                  const elementPosition = elementRect - bodyRect;
                  const offsetPosition = elementPosition - offset;
                  window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                }
              }}
            >
              {content}
            </a>
          );
        }

        if (isExternal) {
          return (
            <a
              key={item.id}
              href={item.href}
              className={className}
            >
              {content}
            </a>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={className}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
