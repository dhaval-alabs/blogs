"use client";

import { useEffect } from "react";
import { captureUtmParams } from "@/utils/captureUtm";
import { initAdvancedTracking } from "@/utils/trackAdvancedBehaviour";

export default function ClientInit() {
  useEffect(() => {
    captureUtmParams();
    initAdvancedTracking();
  }, []);

  return null;
}
