import type { Metadata } from "next";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("找搭子") };
}

export default function FindLayout({ children }: { children: React.ReactNode }) {
  return children;
}
