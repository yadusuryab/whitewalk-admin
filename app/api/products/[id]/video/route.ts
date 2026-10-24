// app/api/products/[id]/video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { verifySession } from "@/lib/auth";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_WRITE_TOKEN, // server-only, no NEXT_PUBLIC_
  useCdn: false,
});

async function authed(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;
  return token ? !!(await verifySession(token)) : false;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await authed(req)))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const form = await req.formData();
    const video = form.get("video") as File | null;
    const poster = form.get("poster") as File | null;
    const set: Record<string, any> = {};
    let videoUrl: string | undefined;
    let posterUrl: string | undefined;

    if (video) {
      const a = await sanity.assets.upload("file", Buffer.from(await video.arrayBuffer()), {
        filename: video.name,
        contentType: video.type,
      });
      set.video = { _type: "file", asset: { _type: "reference", _ref: a._id } };
      videoUrl = a.url;
    }
    if (poster) {
      const a = await sanity.assets.upload("image", Buffer.from(await poster.arrayBuffer()), {
        filename: poster.name,
        contentType: poster.type,
      });
      set.videoPoster = { _type: "image", asset: { _type: "reference", _ref: a._id } };
      posterUrl = a.url;
    }

    await sanity.patch(id).set(set).commit();
    return NextResponse.json({ videoUrl, posterUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await authed(req)))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await sanity.patch(id).unset(["video", "videoPoster"]).commit();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}