"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { isPublicTrackingUrl, isWhatsAppLink, setMetaTrackingEnabled, trackMetaEvent, trackMetaPage, trackMetaPageEvent, type MetaEventData } from "@/lib/meta-pixel";

export function MetaWebsiteTracking() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { status } = useSession();
  useEffect(() => {
    const active = status === "unauthenticated" && isPublicTrackingUrl(new URL(window.location.href));
    setMetaTrackingEnabled(active);
    if (!active) return;
    trackMetaPage();
    // Explicit page events may have mounted before session resolution.
    window.dispatchEvent(new Event("bb-meta-ready"));
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor instanceof HTMLAnchorElement && isWhatsAppLink(anchor.href)) {
        trackMetaEvent("Contact", { content_name: "WhatsApp", contact_method: "whatsapp" });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname, search, status]);
  return null;
}

export function MetaCatalogEvent({ name, data }: { name: "ViewContent" | "Search"; data: MetaEventData }) {
  const serialized = JSON.stringify(data);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const send = () => trackMetaPageEvent(name, JSON.parse(serialized));
    send();
    window.addEventListener("bb-meta-ready", send);
    return () => window.removeEventListener("bb-meta-ready", send);
  }, [name, serialized, pathname, search]);
  return null;
}
