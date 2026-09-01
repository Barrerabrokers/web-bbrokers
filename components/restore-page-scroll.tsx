"use client";

import { useEffect } from "react";

export function RestorePageScroll() {
  useEffect(() => {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.height = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.height = "";
  }, []);

  return null;
}
