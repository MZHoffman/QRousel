function svg(label: string, path: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#1e6b4b"/><path d="${path}" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><text x="64" y="112" text-anchor="middle" fill="#d9f577" font-family="Arial,sans-serif" font-size="14" font-weight="700">${label}</text></svg>`).toString("base64")}`;
}

export const BUILT_IN_ICONS = [
  { name: "Info", imageDataUrl: svg("INFO", "M64 34v2M64 54v30") },
  { name: "Website", imageDataUrl: svg("WEB", "M28 64h72M64 28a54 54 0 0 1 0 72M64 28a54 54 0 0 0 0 72M28 64a36 36 0 0 1 72 0") },
  { name: "Location", imageDataUrl: svg("MAP", "M64 100s30-28 30-51a30 30 0 1 0-60 0c0 23 30 51 30 51ZM64 60a11 11 0 1 0 0-22 11 11 0 0 0 0 22Z") },
  { name: "Contact", imageDataUrl: svg("CALL", "M43 31c-5 4-8 10-6 17 8 30 29 51 59 59 7 2 13-1 17-6l-14-14-12 7c-12-6-21-15-27-27l7-12-14-14Z") },
] as const;
