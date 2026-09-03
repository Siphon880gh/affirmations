import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Affirmation Lab",
  description:
    "Build believable affirmations through typing, recall, word games, reflection, and browser-generated voices.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
