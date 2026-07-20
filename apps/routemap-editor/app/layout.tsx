import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Provider } from "@ui/components/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "RouteMap Editor",
  description: "Live BSicon route-diagram editor",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Light mode only for now (ignores system preference). */}
        <Provider forcedTheme="light">{children}</Provider>
      </body>
    </html>
  );
}
