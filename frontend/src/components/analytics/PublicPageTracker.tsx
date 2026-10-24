"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createPageReading, publicPagePath, startPageTracking } from "../../../public/page-read-tracker";

export default function PublicPageTracker() {
  const pathname = usePathname();
  const reading = useRef<ReturnType<typeof createPageReading> | null>(null);

  useEffect(() => {
    const path = publicPagePath(pathname);
    if (!path) return;
    if (!reading.current || reading.current.path !== path) reading.current = createPageReading(path);
    return startPageTracking(reading.current, process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
  }, [pathname]);

  return null;
}
