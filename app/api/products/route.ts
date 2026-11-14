import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { verifySession } from '@/lib/auth'
import { writeClient, createShoe } from '@/lib/sanity-server'

async function authed(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  return !!token && !!(await verifySession(token))
}

// Fresh, uncached, slim list for the admin table.
// Must return the same fields as your admin QUERY in components/admin/products/shared.
const ADMIN_LIST = `*[_type == "shoe"] | order(orderNumber asc) {
  _id, orderNumber, productName, price, isDisabled, productLabel,
  videoUrl, disabledSizes,
  "img": images[0]
}`

export async function GET(req: NextRequest) {
  if (!(await authed(req)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await writeClient.fetch(ADMIN_LIST))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await authed(req)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const shoe = await createShoe(await req.json())
    revalidateTag('shoes' ,'MAX')
    return NextResponse.json(shoe)
  } catch {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}