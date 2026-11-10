import "./styles.css";
import Link from "next/link";
import { AuthProvider } from "./auth-provider";
import AccountLink from "./account-link";

export const metadata = {
  title: "Fiddle",
  description: "Read your sheet music alongside measure-specific practice tips.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="topbar">
            <div className="site-width topbar-inner">
              <Link className="wordmark" href="/" aria-label="Fiddle home">♫ Fiddle</Link>
              <nav className="site-nav" aria-label="Main navigation">
                <Link href="/">Home</Link>
                <Link href="/practice">Practice Studio</Link>
                <AccountLink />
              </nav>
            </div>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
