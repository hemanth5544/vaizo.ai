import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  destructive: "bg-red-50 text-red-700 border border-red-200",
  accent: "bg-indigo-50 text-indigo-700 border border-indigo-200",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
