import type { Metadata } from "next";
import { Audience } from "@/components/audience";
import { DownloadBand } from "@/components/download-band";
import { Hero } from "@/components/hero";
import { Oars } from "@/components/oars";
import { Session } from "@/components/session";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { AUDIENCES } from "@/lib/audiences";
import { JsonLd, organizationLd, softwareApplicationLd, websiteLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Affirming Antelope: MI practice for healthcare leaders",
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
  keywords: [
    "motivational interviewing for healthcare leaders",
    "motivational interviewing for managers",
    "motivational interviewing practice",
    "difficult conversations practice healthcare",
    "OARS motivational interviewing",
    "MI role play",
  ],
});

export default function Home() {
  return (
    <div id="top">
      <JsonLd data={[organizationLd(), websiteLd(), softwareApplicationLd({ audience: AUDIENCES.leaders.audienceType })]} />
      <SiteNav />
      <main>
        <Hero />
        <Oars />
        <Session />
        <Audience />
        <DownloadBand alsoClinicians />
      </main>
      <SiteFooter />
    </div>
  );
}
