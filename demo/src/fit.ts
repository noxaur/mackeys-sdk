import { useEffect, useRef, useState } from 'react';

/**
 * Scales a device of `natural` px width to the width of its container, up to `max`.
 * With `naturalH`, the device also fits the viewport height, less `reserveH` px for the text around it.
 */
export function useFit(natural: number, max = 1, min = 0.2, naturalH = 0, reserveH = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(max);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      let s = Math.min(max, el.clientWidth / natural);
      if (naturalH) s = Math.min(s, (window.innerHeight - reserveH) / naturalH);
      setScale(Math.max(min, s));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [natural, max, min, naturalH, reserveH]);
  return [ref, scale] as const;
}

/** True while all of the element is on screen. */
export function useFullyOnScreen() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting && e.intersectionRatio > 0.98), { threshold: [0, 0.5, 0.9, 0.98, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}
