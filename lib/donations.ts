import { unstable_cache } from "next/cache";
import { googleFetch, hasCredentials } from "./google";
import { SAMPLE_ROWS } from "./sample";

// How often the sheet is re-read. Keep in sync with `revalidate` in app/page.tsx.
export const REVALIDATE_SECONDS = 60;

export type AuctionKind = "live" | "silent";

export type AuctionItem = {
  id: string;
  title: string;
  description: string;
  auction: AuctionKind;
  donor: string;
  value: string | null;
  startingBid: string | null;
  photoIds: string[];
};

export type Donations = {
  items: AuctionItem[];
  cashTotal: number;
  cashCount: number;
  fetchedAt: string;
  sample: boolean;
};

type Row = Record<string, string>;

/** Read the response tab and return one object per row, keyed by header name. */
async function fetchRows(): Promise<Row[]> {
  const sheetId = process.env.SHEET_ID!;
  const tab = process.env.SHEET_TAB || "Form Responses 1";
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(tab)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await googleFetch(url);
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  const { values = [] } = (await res.json()) as { values?: string[][] };
  const [header = [], ...body] = values;
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((cells) =>
    Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").toString().trim()])),
  );
}

/** Parse "$1,200", "1200", "~$50" etc. Returns null if no number is present. */
function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(n: number): string {
  return usd.format(n);
}

/** Format numeric money values; fall back to the donor's text (e.g. "Priceless"). */
function formatMoney(raw: string): string | null {
  if (!raw) return null;
  const n = parseAmount(raw);
  return n !== null && /^[\s$~≈,.0-9]+$/.test(raw) ? usd.format(n) : raw;
}

/** Form file-upload answers are comma-separated Drive links. */
function extractDriveIds(raw: string): string[] {
  const ids: string[] = [];
  for (const m of raw.matchAll(/(?:[?&]id=|\/d\/)([\w-]{10,})/g)) ids.push(m[1]);
  return ids;
}

function toDonations(rows: Row[], sample: boolean): Donations {
  const items: AuctionItem[] = [];
  let cashTotal = 0;
  let cashCount = 0;

  rows.forEach((r, i) => {
    if (r.auction_title) {
      items.push({
        id: `row-${i + 2}`,
        title: r.auction_title,
        description: r.auction_description ?? "",
        // Anything not marked live (including blank) goes in the silent auction
        auction: /live/i.test(r.auction_type ?? "") ? "live" : "silent",
        donor: r.auction_fullname ?? "",
        value: formatMoney(r.auction_value ?? ""),
        startingBid: formatMoney(r.auction_starting ?? ""),
        photoIds: extractDriveIds(r.auction_photo ?? ""),
      });
    }
    const cash = parseAmount(r.cash_amount ?? "");
    if (cash) {
      cashTotal += cash;
      cashCount += 1;
    }
  });

  // Newest submissions first (form appends rows in submission order)
  items.reverse();
  return { items, cashTotal, cashCount, fetchedAt: new Date().toISOString(), sample };
}

const getLiveDonations = unstable_cache(
  async () => toDonations(await fetchRows(), false),
  ["donations"],
  { revalidate: REVALIDATE_SECONDS },
);

export async function getDonations(): Promise<Donations> {
  if (process.env.USE_SAMPLE_DATA === "1") {
    return toDonations(SAMPLE_ROWS, true);
  }
  if (!hasCredentials()) {
    // Never silently show fake items on the real site
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY");
    }
    return toDonations(SAMPLE_ROWS, true);
  }
  return getLiveDonations();
}
