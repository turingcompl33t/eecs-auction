"""Build auction ingest bundles from the donation sheet.

Reads the same Google Form response sheet as the preview site (credentials
from .env.local, see README) and writes, under the output directory:

    silent/items.jsonl       one JSON object per silent-auction item
    silent/photos/...        photos referenced by those items
    silent.zip               the above, archived for hand-off
    live/...  live.zip       same layout for live-auction items

Usage:
    uv run auction-etl --undecided silent
    uv run auction-etl --undecided live --out bundles/final
"""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import shutil
import string
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from dotenv import load_dotenv
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

AuctionKind = Literal["live", "silent"]

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Columns are read by position, not header text, because Google Forms rewrites
# the header row whenever the form is edited. Must match COLUMNS in
# lib/donations.ts. Index 0 = column A.
COLUMNS = [
    "timestamp",  # A
    "donation_type",  # B
    "cash_fullname",  # C
    "cash_email",  # D
    "cash_amount",  # E
    "auction_fullname",  # F
    "auction_email",  # G
    "auction_title",  # H
    "auction_description",  # I
    "auction_type",  # J
    "auction_value",  # K
    "auction_starting",  # L
    "auction_photo",  # M
    "auction_comments",  # N
    "auction_anon",  # O
]

TIMEOUT = 60


@dataclass
class Item:
    item_id: str
    kind: AuctionKind
    row: dict[str, str]
    photo_ids: list[str]


# --- Google access -----------------------------------------------------------


def _private_key() -> str:
    """Same tolerant parsing as readPrivateKey() in lib/google.ts."""
    key = os.environ.get("GOOGLE_PRIVATE_KEY", "").strip()
    if key.startswith("{"):
        key = json.loads(key).get("private_key", "")
    key = key.strip("\"'").replace("\\n", "\n").replace("\r", "")
    if (
        "-----BEGIN PRIVATE KEY-----" not in key
        or "-----END PRIVATE KEY-----" not in key
    ):
        sys.exit(
            "GOOGLE_PRIVATE_KEY is malformed: expected the private_key value from the service account JSON"
        )
    return key


def google_session() -> AuthorizedSession:
    missing = [
        k
        for k in (
            "SHEET_ID",
            "GOOGLE_SERVICE_ACCOUNT_EMAIL",
            "GOOGLE_PRIVATE_KEY",
        )
        if not os.environ.get(k)
    ]
    if missing:
        sys.exit(
            f"Missing environment variables: {', '.join(missing)} (set them in .env.local)"
        )
    creds = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "client_email": os.environ["GOOGLE_SERVICE_ACCOUNT_EMAIL"],
            "private_key": _private_key(),
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=SCOPES,
    )
    return AuthorizedSession(creds)


def fetch_rows(session: AuthorizedSession) -> list[dict[str, str]]:
    """Return one dict per data row, keyed by COLUMNS, in sheet order."""
    sheet_id = os.environ["SHEET_ID"]
    tab = os.environ.get("SHEET_TAB") or "Form Responses 1"
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{quote(sheet_id, safe='')}"
        f"/values/{quote(tab, safe='')}?valueRenderOption=FORMATTED_VALUE"
    )
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    values = resp.json().get("values", [])
    return [
        {
            col: (cells[i] if i < len(cells) else "").strip()
            for i, col in enumerate(COLUMNS)
        }
        for cells in values[1:]  # skip header
    ]


EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def download_photo(
    session: AuthorizedSession, file_id: str, dest_stem: Path, max_edge: int
) -> Path:
    """Download one Drive photo; returns the written path (extension from content type).

    By default fetches Drive's rendered thumbnail at `max_edge` px: always
    JPEG/PNG, so iPhone HEIC uploads come out usable. Falls back to the
    original file if Drive has no thumbnail. max_edge=0 always takes originals.
    """
    meta_url = (
        f"https://www.googleapis.com/drive/v3/files/{quote(file_id, safe='')}"
        "?fields=name,mimeType,thumbnailLink&supportsAllDrives=true"
    )
    meta = session.get(meta_url, timeout=TIMEOUT)
    meta.raise_for_status()
    info = meta.json()

    thumb = info.get("thumbnailLink")
    if max_edge and thumb:
        resp = session.get(
            re.sub(r"=s\d+$", f"=s{max_edge}", thumb), timeout=TIMEOUT
        )
        resp.raise_for_status()
        ctype = (
            resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        )
        ext = EXT_BY_TYPE.get(ctype, ".jpg")
    else:
        resp = session.get(
            f"https://www.googleapis.com/drive/v3/files/{quote(file_id, safe='')}?alt=media&supportsAllDrives=true",
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        ext = Path(info.get("name", "")).suffix.lower() or EXT_BY_TYPE.get(
            info.get("mimeType", ""), ""
        )

    path = dest_stem.with_suffix(ext)
    path.write_bytes(resp.content)
    return path


# --- Transform ---------------------------------------------------------------


def classify(auction_type: str, undecided: AuctionKind) -> AuctionKind:
    """Same rule as toAuctionKind() in lib/donations.ts; "Don't know" and blank -> undecided."""
    if re.search(r"live", auction_type, re.I):
        return "live"
    if re.search(r"silent", auction_type, re.I):
        return "silent"
    return undecided


def extract_drive_ids(raw: str) -> list[str]:
    """Form file-upload answers are comma-separated Drive links."""
    return re.findall(r"(?:[?&]id=|/d/)([\w-]{10,})", raw)


def parse_money(raw: str) -> int | float | None:
    """'$50' -> 50, '$1,200.00' -> 1200, '~$50' -> 50. None if there is no single clear number."""
    nums = re.findall(r"\d[\d,]*(?:\.\d+)?", raw.replace("$", ""))
    if len(nums) != 1:
        return None
    n = float(nums[0].replace(",", ""))
    return int(n) if n.is_integer() else n


ID_ALPHABET = string.ascii_letters + string.digits
ID_LENGTH = 16  # 62^16 ~ 4.8e28 possibilities


def new_item_id(taken: set[str]) -> str:
    """Random ID like 'WnBnZIQ4VUQWupSS'; unique across both auctions in this run."""
    while True:
        item_id = "".join(secrets.choice(ID_ALPHABET) for _ in range(ID_LENGTH))
        if item_id not in taken:
            taken.add(item_id)
            return item_id


def build_items(
    rows: list[dict[str, str]], undecided: AuctionKind
) -> list[Item]:
    items = []
    taken: set[str] = set()
    for row in rows:
        if not row["auction_title"]:
            continue  # cash-only donation
        # IDs are random, so they differ on every run: the bundles from one
        # run are a matched set and shouldn't be mixed with another run's.
        item_id = new_item_id(taken)
        items.append(
            Item(
                item_id,
                classify(row["auction_type"], undecided),
                row,
                extract_drive_ids(row["auction_photo"]),
            )
        )
    return items


def to_record(item: Item, photos: list[str], warnings: list[str]) -> dict:
    r = item.row
    starting_bid = parse_money(r["auction_starting"])
    if r["auction_starting"] and starting_bid is None:
        warnings.append(
            f"{item.item_id} ({r['auction_title']}): could not parse starting bid {r['auction_starting']!r}"
        )
    return {
        "item_id": item.item_id,
        # Always the real name: the anonymity option only applies to the public preview site.
        "donor": r["auction_fullname"],
        "donor_email": r["auction_email"] or None,
        "item_title": r["auction_title"],
        "item_description": r["auction_description"],
        "starting_bid": starting_bid,
        "photo": photos[0] if photos else None,
        "photos": photos,
    }


# --- Load --------------------------------------------------------------------


def write_bundle(
    session: AuthorizedSession,
    items: list[Item],
    kind: AuctionKind,
    out: Path,
    max_edge: int,
    warnings: list[str],
) -> Path:
    bundle = out / kind
    photo_dir = bundle / "photos"
    photo_dir.mkdir(parents=True)

    with (bundle / "items.jsonl").open("w", encoding="utf-8") as f:
        for item in items:
            photos = []
            for n, file_id in enumerate(item.photo_ids, start=1):
                stem = photo_dir / (
                    item.item_id if n == 1 else f"{item.item_id}-{n}"
                )
                try:
                    path = download_photo(session, file_id, stem, max_edge)
                    photos.append(path.relative_to(bundle).as_posix())
                except Exception as e:  # keep going; report at the end
                    warnings.append(
                        f"{item.item_id} ({item.row['auction_title']}): photo {file_id} failed: {e}"
                    )
            if not item.photo_ids:
                warnings.append(
                    f"{item.item_id} ({item.row['auction_title']}): no photo"
                )
            f.write(
                json.dumps(
                    to_record(item, photos, warnings), ensure_ascii=False
                )
                + "\n"
            )
            print(
                f"  {kind:6} {item.item_id}  {len(photos)} photo(s)  {item.row['auction_title']}"
            )

    archive = shutil.make_archive(
        str(out / kind), "zip", root_dir=out, base_dir=kind
    )
    return Path(archive)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Build silent and live auction ingest bundles from the donation sheet."
    )
    parser.add_argument(
        "--undecided",
        required=True,
        choices=["live", "silent"],
        help="which auction gets items whose type is \"Don't know / don't care\" (or blank)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        help="output directory (must not already exist); default bundles/<timestamp>",
    )
    parser.add_argument(
        "--photo-size",
        type=int,
        default=2048,
        metavar="PX",
        help="longest edge of downloaded photos (Drive-rendered JPEG/PNG); 0 = original files. Default 2048",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path(".env.local"),
        help="default .env.local",
    )
    args = parser.parse_args(argv)

    load_dotenv(args.env_file)
    out: Path = args.out or Path("bundles") / datetime.now().strftime(
        "%Y-%m-%dT%H%M%S"
    )
    if out.exists():
        sys.exit(f"{out} already exists; choose another --out")

    session = google_session()
    rows = fetch_rows(session)
    items = build_items(rows, args.undecided)
    print(
        f"Read {len(rows)} sheet rows, {len(items)} auction items. Undecided items go to: {args.undecided}"
    )

    warnings: list[str] = []
    out.mkdir(parents=True)
    archives = []
    for kind in ("silent", "live"):
        subset = [it for it in items if it.kind == kind]
        archives.append(
            (
                kind,
                len(subset),
                write_bundle(
                    session, subset, kind, out, args.photo_size, warnings
                ),
            )
        )

    print()
    for kind, count, archive in archives:
        print(f"{kind:6} {count:3} items -> {archive}")
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  - {w}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
