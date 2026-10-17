export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "notedly-theme";

export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  return saved === "light" || saved === "dark" ? saved : prefersDark ? "dark" : "light";
}

// Runs before first paint. Storage may be blocked in private/embedded browsers.
export const themeInitScript = `(()=>{let saved=null;try{saved=localStorage.getItem("${THEME_STORAGE_KEY}")}catch{}const dark=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=saved==="light"||saved==="dark"?saved:dark?"dark":"light"})()`;
