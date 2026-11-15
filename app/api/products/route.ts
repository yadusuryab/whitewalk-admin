import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { TAG, authed, saveShoe, writeClient } from "@/lib/sanity-server";

// Bandwidth rules (keep if you edit):
//  1. List = ≤50 rows, slim fields, no `->` joins.
//  2. Heavy fields (sizes, video/poster URL) load for ONE doc, only when editing.
//  3. Thumbs: 112px (192px in editor), q60, auto=format (≈2–5 KB).
//  4. Results cached on the server; every write calls bust() (lib/sanity-server).

const MAX_PER_PAGE = 50;
const CDN = `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${
  process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
}/`;

// "image-<hash>-<WxH>-<ext>" -> CDN URL (no asset join needed in GROQ)
const toUrl = (ref?: string, w = 112) => {
  const m = ref?.match(/^image-(.+)-(\d+x\d+)-(\w+)$/);
  return m ? `${CDN}${m[1]}-${m[2]}.${m[3]}?w=${w}&h=${w}&fit=crop&q=60&auto=format` : null;
};

const LIST_FIELDS = `_id, orderNumber, productName, price, isDisabled, productLabel,
  disabledSizes, offer1Pair, offer2Pair, offer3Pair,
  "hasVideo": defined(video.asset), "img": images[0].asset._ref`;

const LABELS = new Set(["trending", "new-arrival", "best-seller", "limited-edition", "sale"]);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const getList = unstable_cache(
  async (page: number, per: number, q: string, status: string, label: string) => {
    const f = [`_type == "shoe"`];
    if (status === "active") f.push(`isDisabled != true`);
    if (status === "off") f.push(`isDisabled == true`);
    if (label !== "all") f.push(`$label in productLabel`);
    if (q)
      f.push(`(productName match $m || string(orderNumber) == $q || string(price) == $q || _id == $q)`);
    const filter = f.join(" && ");
    const from = (page - 1) * per;

    const res = await writeClient.fetch(
      `{
        "total": count(*[${filter}]),
        "items": *[${filter}] | order(orderNumber asc)[$from...$to]{ ${LIST_FIELDS} }
      }`,
      { label, q, m: `${q}*`, from, to: from + per },
    );
    return {
      total: res.total as number,
      items: res.items.map(({ img, ...s }: any) => ({ ...s, img: toUrl(img) })),
    };
  },
  ["admin-shoes-list"],
  { tags: [TAG], revalidate: 3600 },
);

const getOne = unstable_cache(
  async (id: string) => {
    const s = await writeClient.fetch(
      `*[_type == "shoe" && _id == $id][0]{ ..., "videoUrl": video.asset->url, "posterUrl": videoPoster.asset->url }`,
      { id },
    );
    if (!s) return null;
    const { images, ...rest } = s;
    return { ...rest, img: toUrl(images?.[0]?.asset?._ref, 192) };
  },
  ["admin-shoe"],
  { tags: [TAG], revalidate: 3600 },
);

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  const p = req.nextUrl.searchParams;
  try {
    const id = p.get("id");
    if (id) {
      const shoe = await getOne(id);
      return shoe ? NextResponse.json(shoe) : fail("Not found", 404);
    }
    const num = (k: string, d: number) => Math.max(1, parseInt(p.get(k) || "") || d);
    return NextResponse.json(
      await getList(
        num("page", 1),
        Math.min(num("per", 10), MAX_PER_PAGE),
        (p.get("q") || "").trim().toLowerCase().slice(0, 60),
        p.get("status") || "all",
        p.get("label") || "all",
      ),
    );
  } catch {
    return fail("Failed to fetch products", 500);
  }
}

// Create. Media is uploaded afterwards via /api/products/[id]/media.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const b = await req.json();
    const productName = String(b.productName || "").trim();
    const price = Number(b.price);
    const offers = { offer1Pair: !!b.offer1Pair, offer2Pair: !!b.offer2Pair, offer3Pair: !!b.offer3Pair };
    if (!productName) return fail("Product name is required", 400);
    if (!(price > 0)) return fail("Price must be greater than 0", 400);
    if (!Object.values(offers).some(Boolean)) return fail("Select at least one offer", 400);

    const order = Number(b.orderNumber);
    const _id = await saveShoe(
      null,
      {
        productName,
        price,
        productLabel: (Array.isArray(b.productLabel) ? b.productLabel : []).filter((l: string) => LABELS.has(l)),
        ...offers,
        images: [],
        sizes: [6, 7, 8, 9, 10],
        disabledSizes: [],
        isOffer: false,
        stock: 10,
        isDisabled: false,
        category: "sneakers",
        shoeBrand: "whitewalk",
      },
      order > 0 ? order : undefined,
    );
    return NextResponse.json({ _id });
  } catch {
    return fail("Failed to create product", 500);
  }
}