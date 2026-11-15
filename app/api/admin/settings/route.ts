import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authed, writeClient } from "@/lib/sanity-server";

const UPI = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const s = await writeClient.fetch(
      `*[_type == "settings"][0]{ _id, upiId }`,
    );
    return NextResponse.json({ _id: s?._id ?? null, upiId: s?.upiId ?? "" });
  } catch {
    return fail("Failed to load settings", 500);
  }
}

export async function PUT(req: NextRequest) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const upiId = String((await req.json()).upiId ?? "").trim();
    if (upiId && !UPI.test(upiId))
      return fail("Enter a valid UPI ID (name@bank)", 400);

    const cur = await writeClient.fetch(`*[_type == "settings"][0]{ _id }`);
    // The settings doc is created on first save, not on first read.
    const doc = cur?._id
      ? await writeClient.patch(cur._id).set({ upiId }).commit()
      : await writeClient.create({
          _type: "settings",
          title: "Global Settings",
          freeSocksOffer: false,
          shoeCleanerAddon: false,
          upiId,
        });

    revalidateTag("settings", "max"); // storefront tag, adjust if yours differs
    return NextResponse.json({ _id: doc._id, upiId });
  } catch {
    return fail("Failed to save settings", 500);
  }
}
