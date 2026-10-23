# Glasses cases: order page

Wholesale glasses cases: 50 DA per piece, minimum 16 pieces, colours shuffled, cash on delivery.

- `index.html` — customer order page (prices and minimum are in `CONFIG` at the top of the script)
- `admin.html` — order dashboard (tap the brand name 5 times on the page, or open `/admin.html`)
- `communes.js` — wilaya → communes list
- `supabase/migrations/` — database (orders table, admin allow-list, row-level security)
- `supabase/functions/create-order/` — validates and saves each order, then alerts Telegram

Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) live in Supabase function secrets, never in this repo.
