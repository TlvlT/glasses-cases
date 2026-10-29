# Glasses cases: order page

Wholesale glasses cases: 50 DA per piece, minimum 16 pieces, colours shuffled, cash on delivery.

- `index.html` — customer order page (prices and minimum are in `CONFIG` at the top of the script)
- `admin.html` — order dashboard (tap the brand name 5 times on the page, or open `/admin.html`)
- `communes.js` — wilaya → communes list
- `supabase/migrations/` — database (orders table, admin allow-list, row-level security)
- `supabase/functions/create-order/` — validates and saves each order, then alerts Telegram

Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) live in Supabase function secrets, never in this repo.


## Storefront refresh — 2026-10-29

- `styles.css` contains the storefront styling, with a navy, warm ivory and yellow palette.
- On mobile, the headline, price, minimum order and order button appear before the product gallery.
- The five enhanced product images use `images/*-studio.webp`; gallery thumbnails use `images/*-thumb.webp`. Originals are retained.
- `enhanced-images/` holds the full-resolution edited PNGs and editing prompt in this repository. The original local project also has a copy beside the `site` folder.
- Existing offer wording, prices, delivery calculation, trust content and order submission behavior remain unchanged.
- Local preview: run `python3 -m http.server 8765 --bind 127.0.0.1` from this folder, then open http://127.0.0.1:8765/.
- Validation: JavaScript syntax and Git whitespace checks; desktop/mobile visual review; gallery switching, quantity totals and linked location/address fields. No live order submitted.
- GitHub Pages publishes the root of the `main` branch: https://tlvlt.github.io/glasses-cases/. Keep `index.html`, `styles.css` and `images/` at the root; do not upload a nested `site/` folder.
- `preview/` contains reference screenshots. Original JPEGs and WebPs are retained in `images/` alongside the optimized assets.
