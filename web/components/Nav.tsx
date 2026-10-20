import Link from "next/link";
import { cn } from "@/lib/utils";

export default function Nav({ current }: { current: "pair" | "find" }) {
  const item = (href: string, key: "pair" | "find", label: string) => (
    <Link href={href} aria-current={current === key ? "page" : undefined}
      className={cn("rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
        current === key ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
      {label}
    </Link>
  );
  return (
    <nav className="mb-6 flex items-center gap-1">
      <span className="mr-3 font-bold tracking-tight">匹配搭子</span>
      {item("/", "pair", "查组合")}
      {item("/find", "find", "找搭子")}
    </nav>
  );
}
