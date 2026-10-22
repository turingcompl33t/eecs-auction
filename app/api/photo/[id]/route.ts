import { getCachedDonations, getDonations } from "@/lib/donations";
import { googleFetch } from "@/lib/google";

// Serves form-uploaded photos from Drive via the service account. Only IDs
// that appear in the sheet are served, so this can't be used to read
// arbitrary files the service account has access to.
//
// We fetch Drive's resized thumbnail rather than the original: phone photos
// can exceed Vercel's 4.5MB response limit, and HEIC originals don't render
// in most browsers. Thumbnails are always JPEG/PNG. Cards display at ~380px
// wide, so 800px covers high-DPI screens.
const MAX_EDGE_PX = 800;

const DRIVE_ID = /^[\w-]{10,100}$/;

// Shown while Drive is still generating the thumbnail for a fresh upload (or
// if Drive errors). Never cached, so the real photo appears on a later load.
const PENDING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<rect width="400" height="300" fill="#333c33"/>
<text x="200" y="158" text-anchor="middle" fill="#d3bc8d" font-family="sans-serif" font-size="20" font-weight="600">Photo coming soon</text>
</svg>`;

function pending(): Response {
  return new Response(PENDING_SVG, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}

async function isKnownPhoto(id: string): Promise<boolean> {
  const has = (d: Awaited<ReturnType<typeof getDonations>>) =>
    d.items.some((item) => item.photoIds.includes(id));
  // The cached list can lag the page by up to a minute; on a miss, confirm
  // against a fresh read so a just-submitted photo isn't rejected.
  return has(await getCachedDonations()) || has(await getDonations());
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!DRIVE_ID.test(id) || !(await isKnownPhoto(id))) {
    return new Response("Not found", { status: 404 });
  }

  const meta = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}` +
      `?fields=thumbnailLink&supportsAllDrives=true`,
  );
  if (!meta.ok) return pending();
  const { thumbnailLink } = (await meta.json()) as { thumbnailLink?: string };
  if (!thumbnailLink) return pending();

  const img = await googleFetch(thumbnailLink.replace(/=s\d+$/, `=s${MAX_EDGE_PX}`));
  if (!img.ok || !img.body) return pending();

  return new Response(img.body, {
    headers: {
      "Content-Type": img.headers.get("content-type") ?? "image/jpeg",
      // Photos for a given Drive ID never change; let the CDN hold them
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
