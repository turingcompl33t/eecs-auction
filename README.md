## How it works

A Next.js app (`app/page.tsx`) reads the `Form Responses 1` tab through the Google Sheets API using a service account. The page uses ISR with `revalidate = 60`, so Vercel re-reads the sheet in the background at most once a minute and new form responses appear without a redeploy.

- Rows with an `auction_title` become item cards showing title, description, donor, starting bid, and photo. (`auction_value` is collected but not shown.)
- If `auction_anon` has any answer (the form's "Remain anonymous" checkbox), the card says "Donated by Anonymous" and the donor's name is never sent to the browser. Newest items come first.
- Items are split into **Live Auction** and **Silent Auction** sections based on `auction_type`. Any value containing "live" (any capitalization) goes to Live; everything else, including blanks, goes to Silent.
- `cash_amount` values are added up into one "Cash donations" total. Cash donor names are not shown.
- Emails and `auction_comments` are never sent to the browser.
- Photos uploaded through the form are served by `/api/photo/[id]`. It fetches a resized JPEG from Drive with the service account, so the Drive files stay private. It only serves IDs that appear in the sheet.
- Columns are matched by header name, so reordering columns is fine but renaming headers is not.

## Setup

### 1. Service account (one time)
1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or reuse one).
2. Enable the **Google Sheets API** and the **Google Drive API** (APIs & Services → Library).
3. Go to IAM & Admin → Service Accounts → Create service account. It needs no roles.
4. Open the account → Keys → Add key → JSON. Keep the downloaded file safe.
5. Share with the service account's email (`...@...iam.gserviceaccount.com`) as **Viewer**:
   - the response Google Sheet
   - the Drive folder where the form stores uploaded photos (usually `<Form name> (File responses)` in the form owner's Drive)

### 2. Local development
```bash
npm install
cp .env.example .env.local   # fill in SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
npm run dev                  # http://localhost:3000
```
If no credentials are set, dev mode shows sample data. You can also force sample data with `USE_SAMPLE_DATA=1`.

### 3. Deploy to Vercel
1. Push this directory to a GitHub repo and import it in Vercel. Use the default Next.js settings.
2. Add the same environment variables in Project → Settings → Environment Variables. For `GOOGLE_PRIVATE_KEY`, paste the `private_key` value from the JSON file.
3. Deploy. In production the app refuses to fall back to sample data, so missing credentials cause an error instead of showing fake items.

To change the refresh interval, edit `revalidate` in `app/page.tsx`.
