/** Shared geometry for the Developments and Press stages. */
export function circularOffset(index: number, activeIndex: number, total: number) {
  const raw = index - activeIndex;
  const half = total / 2;
  if (raw > half) return raw - total;
  if (raw < -half) return raw + total;
  return raw;
}

export const positionStyles = {
  "-2": {
    left: "4%",
    width: "min(20vw, 190px)",
    height: "clamp(150px, 22vw, 220px)",
    y: 50,
    scale: 0.72,
    opacity: 0.22,
    rotate: -8,
    zIndex: 5,
  },
  "-1": {
    left: "14%",
    width: "min(34vw, 260px)",
    height: "clamp(210px, 32vw, 325px)",
    y: 28,
    scale: 0.84,
    opacity: 0.66,
    rotate: -4,
    zIndex: 15,
  },
  "0": {
    left: "50%",
    width: "min(82vw, 500px)",
    height: "clamp(310px, 42vw, 420px)",
    y: 0,
    scale: 1,
    opacity: 1,
    rotate: 0,
    zIndex: 30,
  },
  "1": {
    left: "66%",
    width: "min(34vw, 260px)",
    height: "clamp(210px, 32vw, 325px)",
    y: 32,
    scale: 0.84,
    opacity: 0.66,
    rotate: 4,
    zIndex: 15,
  },
  "2": {
    left: "82%",
    width: "min(20vw, 190px)",
    height: "clamp(150px, 22vw, 220px)",
    y: 56,
    scale: 0.72,
    opacity: 0.22,
    rotate: 8,
    zIndex: 5,
  },
} as const;

