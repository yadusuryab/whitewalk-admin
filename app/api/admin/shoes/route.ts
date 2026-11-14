import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { writeClient } from '@/lib/sanity-server'

// Replace with your real admin auth (session/cookie)
function authed(req: Request) {
  return req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await writeClient.patch(id).set(await req.json()).commit()
  revalidateTag('shoes', 'page')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await writeClient.delete(id)
  revalidateTag('shoes', 'page')
  return NextResponse.json({ ok: true })
}