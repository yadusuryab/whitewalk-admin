import "server-only";
import { createClient } from "@sanity/client";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

export const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN, // never NEXT_PUBLIC_
});

/** Cache tag for admin lists. Storefront uses "shoes". */
export const TAG = "admin-shoes";

/** Call after EVERY write. */
export const bust = () => {
  revalidateTag("shoes", "max");
  revalidateTag(TAG, "max");
};

export const authed = async (req: NextRequest) => {
  const t = req.cookies.get("admin_token")?.value;
  return !!t && !!(await verifySession(t));
};

/** Deletes replaced/removed assets so storage doesn't grow. Failures are ignored. */
export const dropAssets = (refs: (string | undefined | null)[]) =>
  Promise.allSettled(refs.filter(Boolean).map((r) => writeClient.delete(r!)));

/**
 * Create (id = null) or update a shoe in ONE transaction.
 * `order` given (or creating) → list is re-numbered 1..N with the shoe at that slot.
 * Returns the shoe id.
 */
export async function saveShoe(
  id: string | null,
  data: Record<string, any>,
  order?: number,
) {
  const shoeId = id ?? crypto.randomUUID();
  const tx = writeClient.transaction();

  if (order !== undefined || !id) {
    const all: { _id: string; orderNumber: number }[] = await writeClient.fetch(
      `*[_type=="shoe"] | order(orderNumber asc)[0...10000]{_id, orderNumber}`,
    );
    const ids = all.map((s) => s._id).filter((x) => x !== shoeId);
    const pos = Math.min(Math.max(1, order ?? ids.length + 1), ids.length + 1);
    ids.splice(pos - 1, 0, shoeId);
    const old = new Map(all.map((s) => [s._id, s.orderNumber]));
    ids.forEach((sid, i) => {
      if (sid === shoeId) data.orderNumber = i + 1;
      else if (old.get(sid) !== i + 1)
        tx.patch(sid, (p) => p.set({ orderNumber: i + 1 }));
    });
  }

  if (id) tx.patch(id, (p) => p.set(data));
  else tx.create({ _id: shoeId, _type: "shoe", ...data });

  await tx.commit();
  bust();
  return shoeId;
}

// Kept for other server code that may still import them.
export const getShoeAdmin = (id: string) =>
  writeClient.fetch(`*[_type == "shoe" && _id == $id][0]`, { id });
export const createShoe = (data: object) => saveShoe(null, { ...data });
export const updateShoe = (id: string, data: object) =>
  saveShoe(id, { ...data });
export const deleteShoe = (id: string) => writeClient.delete(id);

/** "image-<hash>-<WxH>-<ext>" → CDN URL (no asset join in GROQ). Append a query string via `q`. */
export const cdnUrl = (ref?: string | null, q = "") => {
  const m = ref?.match(/^image-(.+)-(\d+x\d+)-(\w+)$/);
  return m
    ? `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${
        process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
      }/${m[1]}-${m[2]}.${m[3]}${q}`
    : null;
};
