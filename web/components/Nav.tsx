import Link from "next/link";

export default function Nav({ current }: { current: "pair" | "find" }) {
  return (
    <nav>
      <Link href="/" aria-current={current === "pair" ? "page" : undefined}>查组合</Link>
      <Link href="/find" aria-current={current === "find" ? "page" : undefined}>找搭子</Link>
    </nav>
  );
}
