// Event details shown in the page header and link previews.
export const EVENT = {
  name: "EECS Auction 2026",
  date: "Friday, November 20, 2026",
  time: "1730–2030",
  venue: "Class of '48 / '98 Lodge, Victor Constant Ski Slope",
  address: "West Point, NY 10996",
};

export const EVENT_MAP_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(`${EVENT.venue}, ${EVENT.address}`);

export const EVENT_SUMMARY = `${EVENT.date}, ${EVENT.time} · ${EVENT.venue}, ${EVENT.address}`;
