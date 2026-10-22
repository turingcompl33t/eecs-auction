import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The page lists donor names, so keep it (and its photos) out of search
  // engines. The site stays reachable by direct link. robots.txt is left open
  // on purpose: crawlers must be able to fetch pages to see this header.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noimageindex" }],
      },
    ];
  },
};

export default nextConfig;
