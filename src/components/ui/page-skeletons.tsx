import { Skeleton } from "./skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-28 mt-2" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 p-4 border rounded-lg">
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="p-4 border rounded-lg">
          <Skeleton className="h-6 w-40 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-6 gap-2 p-3 border-b">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid grid-cols-6 gap-2 p-3">
            {Array.from({ length: 6 }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
