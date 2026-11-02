"use client";

import { useId, useRef } from "react";
import type { AuctionItem } from "@/lib/donations";

// A fixed-size card that opens a modal "focus view" showing the full,
// unclamped text. Uses the native <dialog>, which traps focus, closes on
// Esc (and the Android back gesture), and restores focus to the card.
export default function ItemCard({ item }: { item: AuctionItem }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <article className="card">
        <CardContent
          item={item}
          heading={
            // Stretched over the whole card (see .card-open::after) so the
            // card is clickable while staying a real, focusable button
            <button type="button" className="card-open" onClick={() => dialogRef.current?.showModal()}>
              {item.title}
            </button>
          }
        />
      </article>

      <dialog
        ref={dialogRef}
        className="focus-view"
        aria-labelledby={titleId}
        // A click whose target is the <dialog> itself landed on the backdrop
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
      >
        <div className="focus-panel">
          <button
            type="button"
            className="focus-close"
            aria-label="Close"
            autoFocus
            onClick={() => dialogRef.current?.close()}
          >
            <span aria-hidden>✕</span>
          </button>
          <article className="card card--full">
            <CardContent item={item} heading={<span id={titleId}>{item.title}</span>} />
          </article>
        </div>
      </dialog>
    </>
  );
}

function CardContent({ item, heading }: { item: AuctionItem; heading: React.ReactNode }) {
  const [photo] = item.photoIds;

  return (
    <>
      <div className="card-photo">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photo/${photo}`} alt={item.title} loading="lazy" />
        ) : (
          <span className="card-photo-placeholder" aria-hidden>
            {item.title.charAt(0)}
          </span>
        )}
      </div>

      <div className="card-body">
        <h3>{heading}</h3>
        <p className="card-donor">{item.donor && `Donated by ${item.donor}`}</p>
        <p className="card-description">{item.description}</p>
      </div>

      <dl className="card-prices">
        <div>
          <dt>Starting bid</dt>
          <dd>{item.startingBid ?? "—"}</dd>
        </div>
      </dl>
    </>
  );
}
