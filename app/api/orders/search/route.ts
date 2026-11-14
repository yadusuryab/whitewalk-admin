import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { writeClient } from '@/lib/sanity-server'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token || !(await verifySession(token)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60)
  if (raw.length < 3) return NextResponse.json([])

  // phone-like input: match on the last 10 digits
  const digits = raw.replace(/\D/g, '')
  const term = /^[+\d\s()-]+$/.test(raw) && digits.length >= 3 ? digits.slice(-10) : raw
  const p = `*${term.replace(/[*"\\]/g, '')}*`

  const data = await writeClient.fetch(
    `*[_type == "order" && (
      orderId match $p || customerName match $p || utr match $p ||
      razorpayPaymentId match $p || trackingNumber match $p ||
      contact1 match $p || contact2 match $p
    )] | order(createdAt desc) [0...50] {
      ...,
      "paymentScreenshotUrl": paymentScreenshot.asset->url,
      items[]{
        productName, size, price, isFreeItem,
        "imageUrl": imageUrl.asset->url + "?w=160&h=160&fit=crop&auto=format",
        "productId": product._ref
      }
    }`,
    { p },
  )
  return NextResponse.json(data)
}