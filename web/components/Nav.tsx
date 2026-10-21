"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutNow } from "@/app/authActions";
import { cn } from "@/lib/utils";

export default function Nav({ member }: { member: { name: string; admin?: boolean } | null }) {
  const path = usePathname();
  const item = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? "page" : undefined}
      className={cn("rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
        path === href ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
      {label}
    </Link>
  );
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1">
      <span className="mr-3 font-bold tracking-tight">匹配搭子</span>
      {item("/", "查组合")}
      {item("/find", "找搭子")}
      <div className="ml-auto flex items-center gap-1">
        {member ? (
          <>
            {member.admin && item("/admin", "管理")}
            {item("/account", member.name || "我的账号")}
            <form action={signOutNow}>
              <button className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">退出</button>
            </form>
          </>
        ) : (
          item("/login", "登录")
        )}
      </div>
    </nav>
  );
}
