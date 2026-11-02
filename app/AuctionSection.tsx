import type { AuctionItem } from "@/lib/donations";
import ItemCard from "./ItemCard";

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
