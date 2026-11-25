"use client";

import { useEffect, useRef } from "react";

export function ObsidianMotion() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("oa-inview");
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    document.querySelectorAll("main > section, footer").forEach((section) => {
      // Catalog content must not depend on an intersection animation.
      if (window.location.pathname.startsWith("/desarrollos")) return;
      section.classList.add("oa-reveal");
      observer.observe(section);
    });

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      observer.disconnect();
      document.querySelectorAll(".oa-reveal").forEach((section) => {
        section.classList.remove("oa-reveal", "oa-inview");
      });
    };
  }, []);

  return (
    <>
      <div className="oa-scroll-progress" aria-hidden="true">
        <div ref={progressRef} />
      </div>
    </>
  );
}
