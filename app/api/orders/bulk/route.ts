import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { writeClient } from '@/lib/sanity-server'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token || !(await verifySession(token)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { updates } = await req.json()
  if (!Array.isArray(updates) || updates.length > 200)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const tx = writeClient.transaction()
  updates.forEach((u: { id: string; fulfillmentStatus: string }) =>
    tx.patch(u.id, (p) => p.set({ fulfillmentStatus: u.fulfillmentStatus })),
  )
  await tx.commit()
  return NextResponse.json({ ok: true })
}