import type { Metadata, Viewport } from "next";
import Providers from "./providers";
import "./globals.css";
export const metadata: Metadata = {
  title: "SME Attendance · Employees, in sync",
  description:
    "A clearer view of your team. Attendance, employee management, overtime, and payroll in one workspace.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#21765b",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
