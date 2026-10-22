// Stand-in rows used when no Google credentials are configured, so the page
// can be developed locally. Shape matches the form's response sheet headers.
export const SAMPLE_ROWS: Record<string, string>[] = [
  {
    donation_type: "Auction item",
    auction_fullname: "Prof. Ada Lovelace",
    auction_title: "Dinner with the Department Chair",
    auction_description:
      "A three-course dinner for two at a restaurant of your choosing.\nConversation topics: anything but grant deadlines.",
    auction_type: "Live Auction",
    auction_value: "$200",
    auction_starting: "$75",
  },
  {
    donation_type: "Cash donation",
    cash_fullname: "Anonymous",
    cash_amount: "250",
  },
  {
    donation_type: "Auction item",
    auction_fullname: "The Systems Lab",
    auction_title: "Retired Rack Server (with blinking lights)",
    auction_description: "Fully decommissioned 2U server. Excellent space heater. Drives removed.",
    auction_type: "Silent Auction",
    auction_value: "150",
    auction_starting: "20",
  },
  {
    donation_type: "Auction item",
    auction_fullname: "Grad Student Council",
    auction_title: "Homemade Pie of the Month (3 months)",
    auction_description: "One handmade pie delivered to your office each month, flavor of your choice.",
    auction_type: "Silent Auction",
    auction_value: "Priceless",
    auction_starting: "$30",
  },
  {
    donation_type: "Cash donation",
    cash_fullname: "Alan T.",
    cash_amount: "$100",
  },
];
