import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ActionTracker — TalksOnLaw",
  description: "Smart action item tracker for your law firm",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
