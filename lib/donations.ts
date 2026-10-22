import { unstable_cache } from "next/cache";
import { googleGetJson, hasCredentials } from "./google";
import { SAMPLE_ROWS } from "./sample";

// How long the photo route trusts its cached list of photo IDs. The page itself
// re-reads the sheet on every regeneration (see `revalidate` in app/page.tsx).
const PHOTO_ID_CACHE_SECONDS = 60;

export type AuctionKind = "live" | "silent";

export type AuctionItem = {
  id: string;
  title: string;
  description: string;
  auction: AuctionKind;
  donor: string;
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

// Columns are read by position, not header text: Google Forms rewrites the
// header row from the question text whenever the form is edited. A question
// keeps its column when edited or reordered, and new questions are appended,
// so positions are stable. Index 0 = column A.
const COLUMNS = [
  "timestamp", // A
  "donation_type", // B
  "cash_fullname", // C
  "cash_email", // D
  "cash_amount", // E
  "auction_fullname", // F
  "auction_email", // G
  "auction_title", // H
  "auction_description", // I
  "auction_type", // J
  "auction_value", // K
  "auction_starting", // L
  "auction_photo", // M
  "auction_comments", // N
  "auction_anon", // O
] as const;

/** Read the response tab and return one object per data row, keyed by COLUMNS. */
async function fetchRows(): Promise<Row[]> {
  const sheetId = process.env.SHEET_ID!;
  const tab = process.env.SHEET_TAB || "Form Responses 1";
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(tab)}?valueRenderOption=FORMATTED_VALUE`;
  const { values = [] } = await googleGetJson<{ values?: string[][] }>(url);
  const body = values.slice(1); // skip the header row
  return body.map((cells) =>
    Object.fromEntries(COLUMNS.map((k, i) => [k, (cells[i] ?? "").toString().trim()])),
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
        // auction_anon is a single "Remain anonymous" checkbox: any answer means
        // hide the name. Replaced here so the real name never reaches the page.
        donor: r.auction_anon ? "Anonymous" : (r.auction_fullname ?? ""),
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

async function getLiveDonations(): Promise<Donations> {
  return toDonations(await fetchRows(), false);
}

// Cached copy for the photo route, so loading a page of photos doesn't read
// the sheet once per photo. Not used by the page: stacking this cache under
// the page's own revalidation would delay new donations by up to two periods.
const getCachedLiveDonations = unstable_cache(getLiveDonations, ["donations"], {
  revalidate: PHOTO_ID_CACHE_SECONDS,
});

/** Fresh read of the sheet (or sample data). */
export async function getDonations(): Promise<Donations> {
  return loadDonations(getLiveDonations);
}

/** Possibly up to a minute stale; for high-volume lookups like photo requests. */
export async function getCachedDonations(): Promise<Donations> {
  return loadDonations(getCachedLiveDonations);
}

async function loadDonations(live: () => Promise<Donations>): Promise<Donations> {
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
  return live();
}
