import type { Metadata } from "next";

export const metadata: Metadata = { title: "找搭子" };

export default function FindLayout({ children }: { children: React.ReactNode }) {
  return children;
}
