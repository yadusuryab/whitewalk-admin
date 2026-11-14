import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { writeClient } from '@/lib/sanity-server'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('admin_token')?.value
  if (!token || !(await verifySession(token)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await writeClient.delete(id)
  return NextResponse.json({ ok: true })
}
const SET_KEYS = [
  'fulfillmentStatus', 'paymentStatus',
  'courierName', 'trackingNumber', 'trackingUrl', 'adminNotes',
]
const UNSET_KEYS = ['courierName', 'trackingNumber', 'trackingUrl', 'adminNotes']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('admin_token')?.value
  if (!token || !(await verifySession(token)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const set = Object.fromEntries(
    Object.entries(body.set ?? {}).filter(([k]) => SET_KEYS.includes(k)),
  )
  const unset = ((body.unset ?? []) as string[]).filter((k) => UNSET_KEYS.includes(k))

  let p = writeClient.patch(id).set(set)
  if (unset.length) p = p.unset(unset)
  await p.commit()
  return NextResponse.json({ ok: true })
}