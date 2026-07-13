import { cn } from "@/lib/utils";

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return <div className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
    <div className={cn("h-full rounded-full bg-primary transition-all", indicatorClassName)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>;
}
