import React from 'react';

export function Badge({ status, label, size = 'sm' }) {
  const normalized = (status || label || '').toLowerCase();

  const configs = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    granted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',

    revoked: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    denied: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    disconnected: 'bg-rose-500/10 text-rose-400 border-rose-500/25',

    degraded: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    connecting: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    unknown: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };

  const style = configs[normalized] || configs.unknown;
  const displayText = label || status || 'unknown';

  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-0.5 text-[12px]'
      : 'px-2.5 py-1 text-[13px] font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono uppercase tracking-wider ${sizeClasses} ${style}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {displayText}
    </span>
  );
}
