import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casper Sentinel AI — Autonomous security for AI agents and Casper transactions",
  description:
    "Casper Sentinel AI is an autonomous security layer that screens AI-agent and Casper transaction intent before signature, enforces deterministic policy, and prepares verifiable on-chain evidence.",
};

// Applied before first paint so the stored theme never flashes on load.
const noFlashTheme = `(function(){try{var t=localStorage.getItem("casper-sentinel-theme");document.documentElement.dataset.theme=(t==="light"||t==="dark")?t:"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
