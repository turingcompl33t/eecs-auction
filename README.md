## EECS Auction

This repository contains my development work for the EECS auction.

### Components

- [preview](#donation-collection-and-preview-site)
- [etl](#etl-for-auction-execution)

### Donation Collection and Preview Site

TODO

### ETL for Auction Execution

Execute the ETL for auction execution:

```bash
python src/auction/etl.py --undecided live \
   --out bundles \
   --env-file .env.local
```
