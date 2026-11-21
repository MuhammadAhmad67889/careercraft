import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  description:
    "CareerCraft: build resumes, match them to job descriptions, check ATS compatibility, and track applications, all in one career platform.",
  title: "CareerCraft: Build Your Career. One Application at a Time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
