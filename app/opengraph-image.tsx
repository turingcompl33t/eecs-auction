import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/event";

// Link-preview card for email/Slack/Teams/iMessage. Rendered once at build.
export const alt = `${EVENT.name} preview`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#d3bc8d";

export default async function OpengraphImage() {
  const [crest, semibold, extrabold] = await Promise.all([
    readFile(join(process.cwd(), "public/eecs-crest.png")),
    readFile(join(process.cwd(), "assets/montserrat-600.woff")),
    readFile(join(process.cwd(), "assets/montserrat-800.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 80px",
          background: "#000",
          borderBottom: `14px solid ${GOLD}`,
          color: "#fff",
          fontFamily: "Montserrat",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${crest.toString("base64")}`} width={300} height={300} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: GOLD, fontSize: 30, fontWeight: 600, letterSpacing: 6 }}>AUCTION PREVIEW</div>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 8 }}>EECS AUCTION</div>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>2026</div>
          <div style={{ fontSize: 32, fontWeight: 600, marginTop: 28 }}>{`${EVENT.date} · ${EVENT.time}`}</div>
          <div style={{ color: GOLD, fontSize: 26, fontWeight: 600, marginTop: 8 }}>{EVENT.venue}</div>
          <div style={{ color: GOLD, fontSize: 26, fontWeight: 600 }}>{EVENT.address}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: semibold, weight: 600, style: "normal" },
        { name: "Montserrat", data: extrabold, weight: 800, style: "normal" },
      ],
    },
  );
}
