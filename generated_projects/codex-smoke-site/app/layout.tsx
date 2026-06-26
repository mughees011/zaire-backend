import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'codex-smoke-site',
  description: 'codex-smoke-site is a portfolio for Potential clients. ZAIRE will ship it as a frontend-first experience with no authentication, no database, and no payments in v1.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
