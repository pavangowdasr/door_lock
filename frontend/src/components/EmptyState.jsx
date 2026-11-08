import React from 'react';

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-14 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 mb-4 shadow-sm">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-zinc-200">{title}</h3>
      {description && (
        <p className="mt-1.5 text-[15px] text-zinc-400 max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
