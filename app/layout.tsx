import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ActionTracker — Paradox Principals",
  description: "Smart action item tracker for your law firm",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
