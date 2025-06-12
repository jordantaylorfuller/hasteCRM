import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata = {
  title: "hasteCRM",
  description: "AI-powered CRM platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
