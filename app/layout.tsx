import "./globals.css";
import Link from "next/link";
import { business } from "@/config/business";

export const metadata = { title: business.name, description: business.tagline };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <nav>
            <Link href="/" className="brand">{business.name}</Link>
            <Link href="/#services">Book</Link>
            <Link href="/account">Account</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
