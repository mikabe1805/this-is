import React from "react";

export function PageHeader({
  coverUrl,
  title,
  subtitle,
  rightActions
}: {
  coverUrl?: string;
  title: string;
  subtitle?: React.ReactNode;
  rightActions?: React.ReactNode;
}) {
  return (
    <header className="relative w-full">
      {coverUrl && (
        <div className="relative h-44 w-full overflow-hidden rounded-b-2xl">
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          <div className="scrim absolute inset-0" />
          <div className="absolute bottom-3 left-3 right-3 glass p-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">{title}</h1>
              {subtitle && <div className="text-white/90 text-sm">{subtitle}</div>}
            </div>
            <div className="flex gap-2">{rightActions}</div>
          </div>
        </div>
      )}
    </header>
  );
}
