// Fallback definitions for React Fast Refresh preamble.
// This prevents errors where @vitejs/plugin-react can't detect the preamble script during lazy loads or cached hot reloads.
if (typeof window !== 'undefined') {
  (window as any).$RefreshReg$ = (window as any).$RefreshReg$ || (() => {});
  (window as any).$RefreshSig$ = (window as any).$RefreshSig$ || (() => (type: any) => type);
}
export {};
