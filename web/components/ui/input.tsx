import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:shadow-[0_0_20px_-4px_var(--neon-a)] aria-invalid:border-bad",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
