import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account | 4HRS",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
