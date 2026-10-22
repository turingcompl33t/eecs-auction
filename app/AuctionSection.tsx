import type { AuctionItem } from "@/lib/donations";

export default function AuctionSection(props: {
  id: string;
  title: string;
  blurb: string;
  items: AuctionItem[];
}) {
  return (
    <section className="section" id={props.id} aria-labelledby={`${props.id}-heading`}>
      <div className="section-head">
        <h2 id={`${props.id}-heading`}>{props.title}</h2>
        <span className="section-count">
          {props.items.length} {props.items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <p className="section-blurb">{props.blurb}</p>

      {props.items.length === 0 ? (
        <p className="empty">No items yet. Check back soon!</p>
      ) : (
        <ul className="grid">
          {props.items.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemCard({ item }: { item: AuctionItem }) {
  const [photo] = item.photoIds;

  return (
    <article className="card">
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
        <h3 title={item.title}>{item.title}</h3>
        <p className="card-donor" title={item.donor || undefined}>
          {item.donor && `Donated by ${item.donor}`}
        </p>
        <p className="card-description" title={item.description || undefined}>
          {item.description}
        </p>
      </div>

      <dl className="card-prices">
        <div>
          <dt>Starting bid</dt>
          <dd>{item.startingBid ?? "—"}</dd>
        </div>
      </dl>
    </article>
  );
}
