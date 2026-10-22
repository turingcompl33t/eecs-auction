import { JWT } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

let client: JWT | null = null;

export function hasCredentials(): boolean {
  return Boolean(
    process.env.SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

/**
 * Normalize the private key from env. Dashboards like Vercel store values
 * verbatim, so tolerate the common paste variants: wrapping quotes, literal
 * "\n" escapes, Windows line endings, or the whole service-account JSON.
 */
function readPrivateKey(): string {
  let key = (process.env.GOOGLE_PRIVATE_KEY ?? "").trim();
  if (key.startsWith("{")) {
    key = JSON.parse(key).private_key ?? "";
  }
  key = key.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").replace(/\r/g, "");
  if (!key.includes("-----BEGIN PRIVATE KEY-----") || !key.includes("-----END PRIVATE KEY-----")) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is malformed: expected the private_key value from the service account JSON, " +
        "including the BEGIN/END PRIVATE KEY lines",
    );
  }
  return key;
}

function getClient(): JWT {
  if (!client) {
    client = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: readPrivateKey(),
      scopes: SCOPES,
    });
  }
  return client;
}

/** fetch() against a Google API with the service account's bearer token. */
export async function googleFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { token } = await getClient().getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, cache: "no-store" });
}
