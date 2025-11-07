import React from "react";

export const PANEL_CLASS = "rounded-4xl border border-slate-800 bg-[#091225]/70 px-6 py-6 shadow-[0_48px_140px_-110px_rgba(34,211,238,0.55)] backdrop-blur-2xl";
export const SUBPANEL_CLASS = "rounded-3xl border border-slate-800 bg-slate-900/50 px-5 py-5";
export const INPUT_CLASS = "w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-400/60 focus:ring-0";
export const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-[120px]`;
export const SELECT_CLASS = INPUT_CLASS;
export const CHECKBOX_CLASS = "h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500/30";
export const SWITCH_BASE_CLASS = "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-slate-700 transition focus:outline-none focus:ring-2 focus:ring-sky-500/40";
export const SWITCH_DOT_CLASS = "inline-block h-4 w-4 transform rounded-full bg-slate-200 transition";

export function SectionHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <header className="mb-6 space-y-2">
      {eyebrow && <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>
      {description && <p className="text-sm text-slate-400">{description}</p>}
    </header>
  );
}

export function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function InlineBadge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-400">{children}</span>;
}

export function SectionHighlight({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-5 text-sm text-slate-400">
      <h3 className="text-base font-medium text-slate-200">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}
