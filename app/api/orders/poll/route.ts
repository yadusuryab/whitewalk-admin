import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { writeClient } from '@/lib/sanity-server'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token || !(await verifySession(token)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await writeClient.fetch(
    `{ "count": count(*[_type == "order"]), "latest": math::max(*[_type == "order"]._updatedAt) }`,
  )
  return NextResponse.json(data)
}