import { NextRequest, NextResponse } from "next/server";
import { authed, bust, dropAssets, saveShoe, writeClient } from "@/lib/sanity-server";

type Ctx = { params: Promise<{ id: string }> };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Only these fields can be written from the admin UI.
const KEYS = ["productName", "price", "productLabel", "disabledSizes", "isDisabled", "offer1Pair", "offer2Pair", "offer3Pair"];

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, any> = {};
    for (const k of KEYS) if (body[k] !== undefined) data[k] = body[k];
    if (data.productName !== undefined) data.productName = String(data.productName).trim();
    if (data.productName === "") return fail("Product name is required", 400);
    if (data.price !== undefined && !(Number(data.price) > 0)) return fail("Invalid price", 400);

    const order = body.orderNumber !== undefined ? Number(body.orderNumber) : undefined;
    if (!Object.keys(data).length && order === undefined) return NextResponse.json({ ok: true });

    await saveShoe(id, data, order && order > 0 ? order : undefined);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return fail(e.message || "Failed to update", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const { id } = await params;
    const doc = await writeClient.fetch(
      `*[_id == $id][0]{ "refs": array::compact([...images[].asset._ref, video.asset._ref, videoPoster.asset._ref]) }`,
      { id },
    );
    await writeClient.delete(id);
    await dropAssets(doc?.refs ?? []);
    bust();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return fail(e.message || "Failed to delete", 500);
  }
}