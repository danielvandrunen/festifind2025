import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "FestiFind",
  description: "Your gateway to festivals around the world",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`} suppressHydrationWarning>
        <header className="border-b border-gray-200">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="font-bold text-xl">
              <a href="/" className="text-purple-700 hover:text-purple-900 transition">FestiFind</a>
            </div>
            <nav>
              <ul className="flex gap-6 list-none">
                <li>
                  <a href="/festivals" className="text-gray-700 hover:text-purple-700 transition">Festivals</a>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
