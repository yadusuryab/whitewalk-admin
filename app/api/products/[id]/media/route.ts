import { NextRequest, NextResponse } from "next/server";
import { authed, bust, dropAssets, writeClient } from "@/lib/sanity-server";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const isFile = (f: unknown, type: string): f is File =>
  f instanceof File && f.size > 0 && f.type.startsWith(type);

const upImage = async (f: File) =>
  writeClient.assets.upload("image", Buffer.from(await f.arrayBuffer()), { filename: f.name, contentType: f.type });
const upFile = async (f: File) =>
  writeClient.assets.upload("file", Buffer.from(await f.arrayBuffer()), { filename: f.name, contentType: f.type });

const imgRef = (a: { _id: string }) => ({
  _type: "image",
  _key: crypto.randomUUID(),
  asset: { _type: "reference", _ref: a._id },
});

/**
 * multipart fields (keep each request < 4 MB on Vercel):
 *   image   → replaces the FIRST image (edit)
 *   images  → APPENDS images (create)
 *   video / poster → replaces video / poster
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const { id } = await params;
    const form = await req.formData();
    const image = form.get("image");
    const images = form.getAll("images").filter((f): f is File => isFile(f, "image/"));
    const video = form.get("video");
    const poster = form.get("poster");

    const cur = await writeClient.fetch(
      `*[_id == $id][0]{ images, "video": video.asset._ref, "poster": videoPoster.asset._ref }`,
      { id },
    );
    if (!cur) return fail("Not found", 404);

    const set: Record<string, any> = {};
    const old: (string | undefined)[] = [];
    let imgs: any[] = cur.images ?? [];

    if (isFile(image, "image/")) {
      old.push(imgs[0]?.asset?._ref);
      imgs = [imgRef(await upImage(image)), ...imgs.slice(1)];
      set.images = imgs;
    }
    if (images.length) {
      imgs = [...imgs, ...(await Promise.all(images.map(upImage))).map(imgRef)];
      set.images = imgs;
    }
    if (isFile(video, "video/")) {
      const a = await upFile(video);
      set.video = { _type: "file", asset: { _type: "reference", _ref: a._id } };
      old.push(cur.video);
    }
    if (isFile(poster, "image/")) {
      set.videoPoster = imgRef(await upImage(poster));
      old.push(cur.poster);
    }
    if (!Object.keys(set).length) return fail("No media provided", 400);

    await writeClient.patch(id).set(set).commit();
    await dropAssets(old);
    bust();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return fail(e.message || "Upload failed", 500);
  }
}

// DELETE ?type=video
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await authed(req))) return fail("Unauthorized", 401);
  try {
    const { id } = await params;
    const cur = await writeClient.fetch(
      `*[_id == $id][0]{ "video": video.asset._ref, "poster": videoPoster.asset._ref }`,
      { id },
    );
    await writeClient.patch(id).unset(["video", "videoPoster"]).commit();
    await dropAssets([cur?.video, cur?.poster]);
    bust();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return fail(e.message || "Failed to remove video", 500);
  }
}