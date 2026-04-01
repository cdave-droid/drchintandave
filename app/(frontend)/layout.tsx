import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MedDuel — Clinical Reasoning Game",
  description: "Test your clinical reasoning with real cases.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
