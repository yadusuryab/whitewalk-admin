import { NextRequest, NextResponse } from "next/server";
import { authed, writeClient } from "@/lib/sanity-server";

// One GET endpoint for the orders admin (replaces /api/orders/search and /api/orders/poll):
//   ?page&per&tab&q&status&pay&method&lo&hi → { total, items, counts }  (slim rows)
//   ?...filters&ids=1                        → [{_id, s}]  (for "select all")
//   ?id=<docId>                              → full order (modal only)
//   ?poll=1                                  → { count, recent[5] }  (~400 bytes)

const CDN = `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${
  process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
}/`;
const ITEM_IMG = "?w=160&h=160&fit=crop&auto=format"; // modal's copyImage swaps auto=format → fm=png

const toUrl = (ref?: string | null, q = "") => {
  const m = ref?.match(/^image-(.+)-(\d+x\d+)-(\w+)$/);
  return m ? `${CDN}${m[1]}-${m[2]}.${m[3]}${q}` : null;
};

const ABANDONED = `(shippingMethod != "cod" && paymentStatus in ["pending","failed"])`;

const LIST_FIELDS = `_id, orderId, customerName, contact1, shippingMethod, shoeCleanerAddon,
  freeSocksOffer, totalAmount, codCharge, paymentStatus, fulfillmentStatus, createdAt,
  pairCount, randomThirdSize,
  items[]{ productName, size, price, isFreeItem, "productId": product._ref }`;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

function buildFilter(p: URLSearchParams) {
  const abandoned = p.get("tab") === "abandoned";
  const f = [`_type == "order"`, abandoned ? ABANDONED : `!${ABANDONED}`];
  const params: Record<string, string> = {};

  const set = (k: string, cond: string, val: string | null) => {
    if (val && val !== "all") {
      f.push(cond);
      params[k] = val;
    }
  };
  if (!abandoned) {
    set("status", `fulfillmentStatus == $status`, p.get("status"));
    set("pay", `paymentStatus == $pay`, p.get("pay"));
  }
  set("method", `shippingMethod == $method`, p.get("method"));
  set("lo", `createdAt >= $lo`, p.get("lo"));
  set("hi", `createdAt <= $hi`, p.get("hi"));

  const qr = (p.get("q") || "").trim().slice(0, 60);
  if (qr) {
    const digits = qr.replace(/\D/g, "");
    const phone = /^[+\d\s()-]+$/.test(qr) && digits.length >= 3 ? digits.slice(-10) : "";
    const c = [
      `orderId match $m`,
      `customerName match $m`,
      `orderId == $qr`,
      `utr == $qr`,
      `razorpayPaymentId == $qr`,
      `trackingNumber == $qr`,
    ];
    params.qr = qr;
    params.m = `${qr}*`;
    if (phone) {
      c.push(`contact1 match $ph`, `contact2 match $ph`, `contact1 == $qr`);
      params.ph = `${phone}*`;
    }
    f.push(`(${c.join(" || ")})`);
  }
  return { filter: f.join(" && "), params };
}

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  const p = req.nextUrl.searchParams;
  try {
    if (p.get("poll")) {
      return NextResponse.json(
        await writeClient.fetch(`{
          "count": count(*[_type == "order"]),
          "recent": *[_type == "order"] | order(createdAt desc)[0...5]{ _id, customerName, totalAmount, createdAt }
        }`),
      );
    }

    const id = p.get("id");
    if (id) {
      const s = await writeClient.fetch(
        `*[_type == "order" && _id == $id][0]{
          ...,
          "shot": paymentScreenshot.asset._ref,
          items[]{ productName, size, price, isFreeItem, "img": imageUrl.asset._ref, "productId": product._ref }
        }`,
        { id },
      );
      if (!s) return fail("Not found", 404);
      const { shot, paymentScreenshot, items, ...rest } = s;
      return NextResponse.json({
        ...rest,
        paymentScreenshotUrl: toUrl(shot),
        items: (items ?? []).map(({ img, ...i }: any) => ({ ...i, imageUrl: toUrl(img, ITEM_IMG) })),
      });
    }

    const { filter, params } = buildFilter(p);

    if (p.get("ids")) {
      return NextResponse.json(
        await writeClient.fetch(`*[${filter}] | order(createdAt desc)[0...1000]{ _id, "s": fulfillmentStatus }`, params),
      );
    }

    const num = (k: string, d: number) => Math.max(1, parseInt(p.get(k) || "") || d);
    const per = Math.min(num("per", 10), 50);
    const from = (num("page", 1) - 1) * per;

    const res = await writeClient.fetch(
      `{
        "total": count(*[${filter}]),
        "items": *[${filter}] | order(createdAt desc)[$from...$to]{ ${LIST_FIELDS} },
        "counts": {
          "paid": count(*[_type == "order" && !${ABANDONED}]),
          "abandoned": count(*[_type == "order" && ${ABANDONED}]),
          "verifying": count(*[_type == "order" && paymentStatus == "verifying"])
        }
      }`,
      { ...params, from, to: from + per },
    );
    return NextResponse.json(res);
  } catch {
    return fail("Failed to fetch orders", 500);
  }
}