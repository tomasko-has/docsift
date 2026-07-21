// Shared small UI components used by both the single-document view and batch view.

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-violet-400">
      {children}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-4 border-b border-dashed border-white/10 py-3 text-sm last:border-0">
      <div className="pt-0.5 font-mono text-[11px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="leading-relaxed text-gray-200">{children}</div>
    </div>
  );
}
