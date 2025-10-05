import React from "react";

export function CardShell({
  children,
  variant = "solid",
  className = "",
  onClick,
  ...props
}: {
  children: React.ReactNode;
  variant?: "solid" | "glass";
  className?: string;
  onClick?: () => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  const base = variant === "glass" ? "glass" : "panel";
  return <div className={`${base} p-3 rounded-xl ${className}`} onClick={onClick} {...props}>{children}</div>;
}
