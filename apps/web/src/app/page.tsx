import { Audience } from "@/components/audience";
import { DownloadBand } from "@/components/download-band";
import { Hero } from "@/components/hero";
import { Oars } from "@/components/oars";
import { Session } from "@/components/session";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export default function Home() {
  return (
    <div id="top">
      <SiteNav />
      <main>
        <Hero />
        <Oars />
        <Session />
        <Audience />
        <DownloadBand />
      </main>
      <SiteFooter />
    </div>
  );
}
