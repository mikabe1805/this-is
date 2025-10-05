import React from "react";

export function ActionBar({
  primary,
  secondary = []
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode[];
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-bark-50/90 backdrop-blur supports-[backdrop-filter]:glass p-3 pt-2">
      <div className="max-w-screen-sm mx-auto flex gap-2">
        <div className="flex-1">{primary}</div>
        {secondary.map((s, i) => <div key={i}>{s}</div>)}
      </div>
    </div>
  );
}
