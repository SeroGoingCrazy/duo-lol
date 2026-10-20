import * as React from "react";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** "error" for things that went wrong; "info" for a normal situation that needs a next step. */
export function Alert({ variant = "info", className, children, ...props }:
  React.HTMLAttributes<HTMLDivElement> & { variant?: "info" | "error" }) {
  const Icon = variant === "error" ? AlertCircle : Info;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm",
        variant === "error" ? "error border-bad/40 bg-bad/10 text-bad" : "bg-card",
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
