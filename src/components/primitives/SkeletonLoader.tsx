/**
 * Skeleton loader primitives for loading states
 */

export function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div 
      className={`animate-pulse bg-bark-200 rounded-lg ${className}`}
      role="status"
      aria-label="Loading..."
    />
  );
}

export function SkeletonHero() {
  return (
    <div className="relative h-44 w-full overflow-hidden rounded-b-2xl bg-bark-200 animate-pulse">
      <div className="absolute bottom-3 left-3 right-3 bg-white/10 backdrop-blur-sm p-3 rounded-xl">
        <div className="h-5 bg-bark-300/50 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-bark-300/50 rounded w-1/2"></div>
      </div>
    </div>
  );
}

export function SkeletonCard({ variant = "solid" }: { variant?: "solid" | "glass" }) {
  const baseClass = variant === "glass" ? "glass" : "panel";
  return (
    <div className={`${baseClass} p-4 space-y-3`} role="status" aria-label="Loading content...">
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-bark-300/50 rounded w-3/4"></div>
        <div className="h-4 bg-bark-300/50 rounded w-full"></div>
        <div className="h-4 bg-bark-300/50 rounded w-5/6"></div>
        <div className="flex gap-2">
          <div className="h-6 bg-bark-300/50 rounded-full w-16"></div>
          <div className="h-6 bg-bark-300/50 rounded-full w-20"></div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

