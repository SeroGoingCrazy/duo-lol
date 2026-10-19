import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "英雄联盟匹配搭子",
  description: "预测两名美服玩家一起打单双排的胜率，并推荐搭子",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <main>
          {children}
          <footer>
            非 Riot Games 官方产品，与 Riot Games 无关。预测算法改编自{" "}
            <a href="https://github.com/vigovlugt/draftgap">DraftGap</a>（MIT License）。
          </footer>
        </main>
      </body>
    </html>
  );
}
