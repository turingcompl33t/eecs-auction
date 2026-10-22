import { formatUsd, getDonations } from "@/lib/donations";
import AuctionSection from "./AuctionSection";

// Re-render at most this often; the sheet is re-read in the background, so new
// form responses show up without a redeploy. Next.js requires a literal here;
// keep in sync with REVALIDATE_SECONDS in lib/donations.ts.
export const revalidate = 60;

export default async function Page() {
  const { items, cashTotal, cashCount, fetchedAt, sample } = await getDonations();
  const live = items.filter((i) => i.auction === "live");
  const silent = items.filter((i) => i.auction === "silent");

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          {sample && (
            <p className="banner">Showing sample data. Configure Google credentials to load the live sheet.</p>
          )}
          <div className="hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="crest"
              src="/eecs-crest.png"
              alt="Department of Electrical Engineering and Computer Science crest"
              width={320}
              height={320}
            />
            <div>
              <p className="eyebrow">Auction preview</p>
              <h1>EECS Auction 2026</h1>
              <p className="lede">
                This page provides a preview of the auction, displaying the donated items that we&rsquo;ve received so far. Updates propagate within about a minute of a new submission, just refresh your browser.
              </p>
            </div>
          </div>
          <div className="stats">
            <a href="#live">
              <span className="stat-label">Live auction</span>
              <span className="stat-value">{live.length}</span>
            </a>
            <a href="#silent">
              <span className="stat-label">Silent auction</span>
              <span className="stat-value">{silent.length}</span>
            </a>
            {cashCount > 0 && (
              <div>
                <span className="stat-label">Cash donations</span>
                <span className="stat-value">{formatUsd(cashTotal)}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page">
        <AuctionSection
          id="live"
          title="Live Auction"
          blurb="Auctioned on stage during the event."
          items={live}
        />
        <AuctionSection
          id="silent"
          title="Silent Auction"
          blurb="Bid on these throughout the event."
          items={silent}
        />

        <footer className="footer">
          Last updated <LocalTime iso={fetchedAt} />
        </footer>
      </main>
    </>
  );
}

function LocalTime({ iso }: { iso: string }) {
  const label = new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.DISPLAY_TIMEZONE || "America/New_York",
  });
  return <time dateTime={iso}>{label}</time>;
}
