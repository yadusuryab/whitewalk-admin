import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authed, cdnUrl, writeClient } from "@/lib/sanity-server";

// GET  ?page&per&q&status → { all, total, items }   (slim rows, first image only, no joins to images)
// GET  ?shoes=1           → [{ _id, productName }]  (only when the Add modal needs it)
// POST multipart          → create review + upload images (compressed client-side)
// PUT/DELETE of one review stay in /api/reviews/[id].

const MAX_IMAGES = 8;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  const p = req.nextUrl.searchParams;
  try {
    if (p.get("shoes"))
      return NextResponse.json(
        await writeClient.fetch(`*[_type == "shoe"] | order(productName asc)[0...2000]{ _id, productName }`),
      );

    const f = [`_type == "review"`];
    const status = p.get("status");
    if (status === "approved") f.push(`isApproved == true`);
    if (status === "pending") f.push(`isApproved != true`);
    const q = (p.get("q") || "").trim().slice(0, 60);
    if (q) f.push(`(customerName match $m || reviewText match $m || shoe->productName match $m)`);
    const filter = f.join(" && ");

    const num = (k: string, d: number) => Math.max(1, parseInt(p.get(k) || "") || d);
    const per = Math.min(num("per", 10), 50);
    const from = (num("page", 1) - 1) * per;

    const res = await writeClient.fetch(
      `{
        "all": count(*[_type == "review"]),
        "total": count(*[${filter}]),
        "items": *[${filter}] | order(createdAt desc)[$from...$to]{
          _id, customerName, rating, reviewText, isVerifiedPurchase, isApproved, createdAt,
          "shoeName": shoe->productName,
          "imgCount": count(reviewImages),
          "img": reviewImages[0].asset._ref
        }
      }`,
      { m: `${q}*`, from, to: from + per },
    );
    return NextResponse.json({
      ...res,
      // base URL only; the client appends size params (thumb vs lightbox)
      items: res.items.map(({ img, ...r }: any) => ({ ...r, img: cdnUrl(img) })),
    });
  } catch {
    return fail("Failed to fetch reviews", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const fd = await req.formData();
    const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.type.startsWith("image/"));
    if (!files.length) return fail("Add at least one image", 400);
    if (files.length > MAX_IMAGES) return fail(`Max ${MAX_IMAGES} images`, 400);

    const assets = await Promise.all(
      files.map(async (f) =>
        writeClient.assets.upload("image", Buffer.from(await f.arrayBuffer()), {
          filename: f.name,
          contentType: f.type,
        }),
      ),
    );

    const shoeId = String(fd.get("shoeId") || "");
    const rating = Math.min(5, Math.max(1, Number(fd.get("rating")) || 5));
    const doc = await writeClient.create({
      _type: "review",
      customerName: String(fd.get("name") || "").trim() || "Anonymous",
      rating,
      reviewText: String(fd.get("text") || ""),
      isVerifiedPurchase: fd.get("verified") === "true",
      isApproved: true,
      createdAt: new Date().toISOString(),
      reviewImages: assets.map((a) => ({
        _type: "image",
        _key: crypto.randomUUID(),
        asset: { _type: "reference", _ref: a._id },
      })),
      ...(shoeId && { shoe: { _type: "reference", _ref: shoeId } }),
    });

    revalidateTag("reviews", "max"); // storefront tag, adjust if yours differs
    return NextResponse.json({ _id: doc._id });
  } catch (e: any) {
    return fail(e.message || "Failed to add review", 500);
  }
}