"use client";

import {useEffect, useRef, useState} from "react";
import {resolveTheme, THEME_STORAGE_KEY, type Theme} from "../../lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    function sync() {
      let saved = null;
      try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch {}
      const next = resolveTheme(saved, system.matches);
      document.documentElement.dataset.theme = next;
      setTheme(next);
      setReady(true);
    }
    function storage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY || event.key === null) sync();
    }
    sync();
    system.addEventListener("change", sync);
    window.addEventListener("storage", storage);
    return () => {
      system.removeEventListener("change", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  async function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (busy.current) return;
    const root = document.documentElement;
    const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => {
      root.dataset.theme = next;
      setTheme(next);
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }
    busy.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-radius", `${Math.hypot(Math.max(x, window.innerWidth-x), Math.max(y, window.innerHeight-y))}px`);
    const doc = document as Document & {startViewTransition?: (update: () => void) => {finished: Promise<void>}};
    try {
      if (doc.startViewTransition) {
        root.dataset.themeTransition = "reveal";
        await doc.startViewTransition(apply).finished;
      } else {
        root.dataset.themeTransition = "fade";
        apply();
        await new Promise(resolve => window.setTimeout(resolve, 1050));
      }
    } catch {
      apply(); // Theme selection still works if the browser skips the animation.
    } finally {
      delete root.dataset.themeTransition;
      busy.current = false;
    }
  }

  return <button type="button" className="theme-toggle" onClick={toggle} disabled={!ready}
    aria-label="Dark mode" aria-pressed={theme === "dark"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
    <span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-thumb">
      <svg className="theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
      <svg className="theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.6 13.1A8.7 8.7 0 0 1 10.9 3.4a8.7 8.7 0 1 0 9.7 9.7Z"/></svg>
    </span></span><span className="theme-toggle-label">Dark mode</span>
  </button>;
}
