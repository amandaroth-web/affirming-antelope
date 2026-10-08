import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Affirming Antelope",
  applicationName: "Affirming Antelope",
  description:
    "The fun way to get better at Motivational Interviewing. Daily OARS drills from Amanda.",
  openGraph: {
    type: "website",
    siteName: "Affirming Antelope",
    title: "Affirming Antelope",
    description:
      "Five-minute OARS drills that help Motivational Interviewing skills stick.",
  },
  twitter: {
    card: "summary",
    title: "Affirming Antelope",
    description:
      "Five-minute OARS drills that help Motivational Interviewing skills stick.",
  },
};

export const viewport: Viewport = {
  themeColor: "#EEF1FF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
