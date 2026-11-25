import type { ReactNode } from "react";

// Keep development content visible without scroll or animation initialization.
export function DevelopmentMotion({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
