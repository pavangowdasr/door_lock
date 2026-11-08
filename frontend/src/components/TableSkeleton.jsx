import React from 'react';

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full animate-pulse space-y-3 py-2">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/50"
        >
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={cIdx}
              className={`h-4 bg-zinc-800/70 rounded ${
                cIdx === 0 ? 'w-28' : cIdx === 1 ? 'w-44' : 'flex-1'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
