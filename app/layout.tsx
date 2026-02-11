import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import ActivityTracker from "./components/ActivityTracker";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"]
});

export const metadata: Metadata = {
  title: "CustomsClear",
  description: "Formal Entry Processing System"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <ActivityTracker />
        <Header />
        {children}
      </body>
    </html>
  );
}
