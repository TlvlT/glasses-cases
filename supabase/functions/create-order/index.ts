// POST /functions/v1/create-order
// Validates the order (never trusts the browser), saves it, then alerts Telegram.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (several ids separated by commas).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deployed with verify_jwt = false because the page only sends the publishable key.
import { createClient } from "npm:@supabase/supabase-js@2";

const UNIT_PRICE = 50;
const MIN_QTY = 16;
const MAX_QTY = 5000;
const DUPLICATE_WINDOW_MIN = 10;   // same phone twice within this window = duplicate
const BURST_WINDOW_MIN = 5;        // spam brake: too many orders overall in this window
const BURST_LIMIT = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const squash = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n: number) => n.toLocaleString("fr-DZ").replace(/[  ]/g, " ");

type Order = {
  customer_name: string; phone: string; wilaya: string; commune: string;
  delivery_type: "home" | "desk"; address: string; quantity: number;
};

function validate(input: Record<string, unknown>): { value?: Order; field?: string } {
  const name = squash(input.customer_name);
  if (name.length < 3 || name.length > 100 || !/\p{L}/u.test(name)) return { field: "name" };

  const phone = String(input.phone ?? "");
  if (!/^0[567]\d{8}$/.test(phone)) return { field: "phone" };

  const wilaya = squash(input.wilaya);
  if (!/^\d{2} - .{2,40}$/u.test(wilaya)) return { field: "wilaya" };

  const commune = squash(input.commune);
  if (commune.length < 2 || commune.length > 60) return { field: "commune" };

  const delivery = input.delivery_type;
  if (delivery !== "home" && delivery !== "desk") return { field: "delivery" };

  const address = delivery === "home" ? squash(input.address).slice(0, 300) : "";
  if (delivery === "home" && address.length < 8) return { field: "address" };

  const quantity = input.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < MIN_QTY || quantity > MAX_QTY) {
    return { field: "quantity" };
  }
  return { value: { customer_name: name, phone, wilaya, commune, delivery_type: delivery, address, quantity } };
}

function message(id: number, o: Order, total: number) {
  const lines = [
    `🆕 <b>طلب جديد #${id}</b>`,
    "",
    `👤 ${esc(o.customer_name)}`,
    `📞 <code>${o.phone}</code>`,
    `📍 ${esc(o.wilaya)} · ${esc(o.commune)}`,
    `🚚 ${o.delivery_type === "home" ? "إلى المنزل" : "إلى مكتب التوصيل"}`,
  ];
  if (o.address) lines.push(`🏠 ${esc(o.address)}`);
  lines.push(
    "",
    `📦 <b>${o.quantity} قطعة</b> × ${UNIT_PRICE} دج (ألوان مشكّلة)`,
    `💰 <b>${fmt(total)} دج</b> + التوصيل (الدفع عند الاستلام)`,
  );
  return lines.join("\n");
}

async function notifyTelegram(text: string): Promise<boolean> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chats = (Deno.env.get("TELEGRAM_CHAT_ID") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || chats.length === 0) return false;
  const sent = await Promise.all(chats.map((chat_id) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    }).then((r) => r.ok).catch(() => false)
  ));
  return sent.some(Boolean);   // delivered to at least one chat
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ success: false, error: "Bad JSON" }, 400); }
  if (!input || typeof input !== "object") return json({ success: false, error: "Bad JSON" }, 400);

  // bot trap: the honeypot field must stay empty. Pretend it worked, store nothing.
  if (input.website) return json({ success: true, order_id: "—" });

  const checked = validate(input);
  if (!checked.value) return json({ success: false, error: "Invalid", field: checked.field }, 400);
  const order = checked.value;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const since = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

  const dup = await db.from("orders").select("id", { count: "exact", head: true })
    .eq("phone", order.phone).gte("created_at", since(DUPLICATE_WINDOW_MIN));
  if (dup.error) return json({ success: false, error: "Server error" }, 500);
  if ((dup.count ?? 0) > 0) return json({ success: false, error: "Duplicate order" }, 429);

  const burst = await db.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since(BURST_WINDOW_MIN));
  if ((burst.count ?? 0) >= BURST_LIMIT) return json({ success: false, error: "Too many orders" }, 429);

  const total = order.quantity * UNIT_PRICE;   // price is always computed here, never taken from the browser
  const ins = await db.from("orders").insert({ ...order, unit_price: UNIT_PRICE, total_price: total }).select("id").single();
  if (ins.error) { console.error("insert failed", ins.error.message); return json({ success: false, error: "Server error" }, 500); }

  // the order is saved at this point, so a Telegram problem must not fail the customer's request
  const sent = await notifyTelegram(message(ins.data.id, order, total));
  if (sent) await db.from("orders").update({ telegram_sent: true }).eq("id", ins.data.id);
  else console.error("telegram not sent for order", ins.data.id);

  return json({ success: true, order_id: ins.data.id });
});
