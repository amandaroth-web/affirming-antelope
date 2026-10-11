import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Shared Open Graph card: brand fonts, colours, and the mascot. 1200×630. */

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

const dir = join(process.cwd(), "assets", "og");
const assets = Promise.all([
  readFile(join(dir, "Fredoka_700Bold.ttf")),
  readFile(join(dir, "Nunito_800ExtraBold.ttf")),
  readFile(join(dir, "mascot-wave.png"), "base64"),
  readFile(join(dir, "mascot-celebrate.png"), "base64"),
  readFile(join(dir, "logo.png"), "base64"),
]);

const C = {
  cobalt: "#4F6BED",
  deep: "#374FBF",
  navy: "#0A284E",
  ochre: "#E8A638",
  soft: "#EEF1FF",
  ink: "#2E3448",
  muted: "#68708C",
  line: "#DFE3F2",
  shadow: "#CBD1E5",
};

type OgCard = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  pose?: "wave" | "celebrate";
  /** Footer chip, e.g. "7 min read". */
  meta?: string;
};

export async function renderOg({ eyebrow, title, subtitle, pose = "wave", meta }: OgCard) {
  const [fredoka, nunito, wave, celebrate, logo] = await assets;
  const mascot = `data:image/png;base64,${pose === "wave" ? wave : celebrate}`;
  const titleSize = title.length > 52 ? 60 : title.length > 34 ? 68 : 78;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: C.soft,
          padding: 56,
          fontFamily: "Nunito",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            background: "#FFFFFF",
            border: `3px solid ${C.line}`,
            borderRadius: 40,
            boxShadow: `0 10px 0 ${C.shadow}`,
            padding: "48px 0 44px 56px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: 650, height: "100%" }}>
            <div style={{ display: "flex" }}>
              <div
                style={{
                  display: "flex",
                  background: C.soft,
                  color: C.deep,
                  fontSize: 26,
                  fontWeight: 800,
                  padding: "8px 18px",
                  borderRadius: 16,
                }}
              >
                {eyebrow}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontFamily: "Fredoka",
                fontSize: titleSize,
                lineHeight: 1.05,
                color: C.ink,
                letterSpacing: -1.5,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ display: "flex", marginTop: 22, fontSize: 30, lineHeight: 1.3, color: C.muted }}>
                {subtitle}
              </div>
            )}
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={`data:image/png;base64,${logo}`} width={56} height={52} />
              <div style={{ display: "flex", marginLeft: 14, fontFamily: "Fredoka", fontSize: 32, color: C.deep }}>
                Affirming Antelope
              </div>
              {meta && (
                <div
                  style={{
                    display: "flex",
                    marginLeft: 22,
                    fontSize: 24,
                    color: C.muted,
                    padding: "6px 14px",
                    border: `2px solid ${C.line}`,
                    borderRadius: 14,
                  }}
                >
                  {meta}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              right: 36,
              bottom: 0,
              width: 300,
              height: 470,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 30,
                width: 280,
                height: 280,
                borderRadius: 140,
                background: C.soft,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={mascot} width={pose === "wave" ? 296 : 331} height={430} style={{ position: "relative", marginBottom: 12 }} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 180,
              height: 14,
              background: C.ochre,
              borderTopRightRadius: 37,
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: "Fredoka", data: fredoka, weight: 700, style: "normal" },
        { name: "Nunito", data: nunito, weight: 800, style: "normal" },
      ],
    },
  );
}
