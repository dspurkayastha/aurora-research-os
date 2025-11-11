import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurora Research OS",
  description: "Draft research packages aligned with Indian clinical research guidelines."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <span className="text-xl font-semibold">Aurora Research OS</span>
            <span className="text-sm text-slate-500">Indian Guidelines Aligned</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
