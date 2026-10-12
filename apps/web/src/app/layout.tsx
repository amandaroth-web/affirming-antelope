import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";

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
  metadataBase: new URL("https://affirmingantelope.com"),
  title: {
    default: "Affirming Antelope: MI practice for healthcare leaders",
    template: "%s · Affirming Antelope",
  },
  applicationName: "Affirming Antelope",
  description:
    "Free Motivational Interviewing practice for healthcare leaders: five-minute drills and live AI role-plays with realistic employees for performance, change, and burnout conversations, plus opt-in trainer review. Clinicians have their own pathway. Works in your browser.",
  openGraph: {
    type: "website",
    siteName: "Affirming Antelope",
    locale: "en_US",
    title: "Affirming Antelope: MI practice for healthcare leaders",
    description:
      "Five-minute drills and live role-plays for managers and team leads: rehearse performance, change, and burnout conversations before you have them. Free, in your browser.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Affirming Antelope: MI practice for healthcare leaders",
    description:
      "Five-minute drills and live role-plays for managers and team leads: rehearse performance, change, and burnout conversations before you have them. Free, in your browser.",
  },
  formatDetection: { telephone: false },
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
        <AnalyticsProvider />
      </body>
    </html>
  );
}
