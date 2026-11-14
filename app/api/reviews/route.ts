import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { writeClient } from '@/lib/sanity-server'

async function authed(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  return !!token && !!(await verifySession(token))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { isApproved } = await req.json()
  if (typeof isApproved !== 'boolean')
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  await writeClient.patch(id).set({ isApproved }).commit()
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await writeClient.delete(id)
  return NextResponse.json({ ok: true })
}