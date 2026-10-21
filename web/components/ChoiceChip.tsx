import { cn } from "@/lib/utils";

/** A checkbox or radio drawn as a pill, for 偏好 and 牌堆 filters. */
export default function ChoiceChip({ type = "checkbox", name, value, checked, disabled, onChange, children }: {
  type?: "checkbox" | "radio"; name?: string; value?: string; checked: boolean; disabled?: boolean;
  onChange: () => void; children: React.ReactNode;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
      checked ? "bg-accent font-semibold" : "text-muted-foreground hover:text-foreground",
      disabled && "cursor-not-allowed opacity-50")}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      {children}
    </label>
  );
}
