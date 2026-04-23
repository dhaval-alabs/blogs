"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Whenever pathname or searchParams change, the navigation is complete
    setIsNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (e) => {
      // Defensive check for target and closest support
      const target = (e?.target && typeof e.target.closest === "function") 
        ? e.target.closest("a[href]") 
        : null;
      
      if (!target) return;
      
      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");
      
      // Ignore external links, new tabs, and anchor links
      if (
        !href || 
        href.startsWith("#") || 
        href.startsWith("http") || 
        targetAttr === "_blank" ||
        e.metaKey || 
        e.ctrlKey
      ) {
        return;
      }
      
      // Add loading state to the clicked button if it looks like a button
      if (
        target.classList.contains("glass-btn") || 
        target.classList.contains("glass-chip") || 
        target.classList.contains("btn-primary-gradient") ||
        target.classList.contains("btn") ||
        target.tagName === "BUTTON"
      ) {
        target.classList.add("btn-global-loading");
      }
      
      setIsNavigating(true);
      
      // Failsafe: turn off loader after 5 seconds just in case
      setTimeout(() => {
        setIsNavigating(false);
        target.classList.remove("btn-global-loading");
      }, 5000);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    // Whenever pathname or searchParams change, the navigation is complete
    setIsNavigating(false);
    
    // Remove loading class from any buttons that had it
    document.querySelectorAll(".btn-global-loading").forEach(el => {
      el.classList.remove("btn-global-loading");
    });
  }, [pathname, searchParams]);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-[9999] pointer-events-none">
      <div className="h-full bg-blue-500 w-full animate-nav-progress shadow-[0_0_10px_#3b82f6]" />
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes nav-progress {
          0% { width: 0%; opacity: 1; }
          20% { width: 40%; }
          60% { width: 70%; }
          90% { width: 90%; }
          100% { width: 95%; opacity: 1; }
        }
        .animate-nav-progress {
          animation: nav-progress 10s cubic-bezier(0.075, 0.82, 0.165, 1) forwards;
        }
      `}} />
    </div>
  );
}
