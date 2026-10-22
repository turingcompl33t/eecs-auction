import { getDonations } from "@/lib/donations";
import { googleFetch } from "@/lib/google";

// Serves form-uploaded photos from Drive via the service account. Only IDs
// that appear in the sheet are served, so this can't be used to read
// arbitrary files the service account has access to.
//
// We fetch Drive's resized thumbnail rather than the original: phone photos
// can exceed Vercel's 4.5MB response limit, and HEIC originals don't render
// in most browsers. Thumbnails are always JPEG/PNG.
const MAX_EDGE_PX = 1600;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { items } = await getDonations();
  if (!items.some((item) => item.photoIds.includes(id))) {
    return new Response("Not found", { status: 404 });
  }

  const meta = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}` +
      `?fields=thumbnailLink,mimeType&supportsAllDrives=true`,
  );
  if (!meta.ok) {
    return new Response("Photo unavailable", { status: 502 });
  }
  const { thumbnailLink } = (await meta.json()) as { thumbnailLink?: string };

  const img = thumbnailLink
    ? await googleFetch(thumbnailLink.replace(/=s\d+$/, `=s${MAX_EDGE_PX}`))
    : await googleFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
      );
  if (!img.ok || !img.body) {
    return new Response("Photo unavailable", { status: 502 });
  }

  return new Response(img.body, {
    headers: {
      "Content-Type": img.headers.get("content-type") ?? "image/jpeg",
      // Photos for a given Drive ID never change; let the CDN hold them
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
