/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import { BLUE_TAG, Tag } from "@/components/admin/ui";

/* ---------- types ---------- */

export interface OrderItem {
  productName: string;
  size: number;
  price: number;
  isFreeItem: boolean;
  imageUrl?: string | null;
  productId?: string | null;
}

export type Fulfillment =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus =
  | "verifying"
  | "paid"
  | "pending"
  | "rejected"
  | "failed"
  | "refunded";

export interface Order {
  _id: string;
  orderId: string;
  pairCount?: number;
  items: OrderItem[];
  customerName: string;
  instagramId?: string;
  contact1: string;
  contact2?: string;
  address: string;
  district: string;
  state: string;
  pincode: string;
  landmark?: string;
  shippingMethod: "online" | "cod";
  shoeCleanerAddon: boolean;
  freeSocksOffer: boolean;
  subtotal: number;
  shippingCharge: number;
  totalAmount: number;
  advancePaid?: number;
  remainingAmount?: number;
  expectedDeliveryLabel: string;
  paymentMethod?: "manual_upi" | "razorpay";
  paymentScreenshotUrl?: string | null;
  utr?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: Fulfillment;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  adminNotes?: string;
  createdAt: string;
}

export type MethodFilter = "all" | Order["shippingMethod"];

// Image fields are Sanity objects, so resolve them to CDN URLs here.
// "auto=format" is also what copyImage() swaps for "fm=png".
export const QUERY = `*[_type == "order"] | order(createdAt desc) {
  ...,
  "paymentScreenshotUrl": paymentScreenshot.asset->url,
  items[]{
    productName, size, price, isFreeItem,
    "imageUrl": imageUrl.asset->url + "?w=160&h=160&fit=crop&auto=format",
    "productId": product._ref
  }
}`;

/* ---------- constants ---------- */

export const COD_ADVANCE = 300;

export const STATUS: Record<Fulfillment, { style: string; Icon: any }> = {
  pending: { style: "bg-neutral-100 text-neutral-600", Icon: Clock },
  processing: { style: "bg-amber-50 text-amber-700", Icon: Package },
  shipped: { style: "bg-blue-600/10 text-blue-700", Icon: Truck },
  delivered: { style: "bg-green-50 text-green-700", Icon: CheckCircle2 },
  cancelled: { style: "bg-red-50 text-red-600", Icon: XCircle },
};
export const STATUSES = Object.keys(STATUS) as Fulfillment[];

export const PAY_STYLE: Record<PaymentStatus, string> = {
  verifying: "bg-blue-600/10 text-blue-700",
  paid: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
  failed: "bg-red-50 text-red-600",
  refunded: "bg-neutral-100 text-neutral-600",
};
export const PAY_LABEL: Record<PaymentStatus, string> = {
  verifying: "Awaiting verification",
  paid: "Paid",
  pending: "Pending",
  rejected: "Rejected",
  failed: "Failed",
  refunded: "Refunded",
};
export const PAY_STATUSES = Object.keys(PAY_LABEL) as PaymentStatus[];

/* ---------- helpers ---------- */

export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// "verifying" and "rejected" are real (UPI) orders, so they stay in Orders.
export const isAbandoned = (o: Order) =>
  o.paymentStatus === "pending" || o.paymentStatus === "failed";

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const fmtDateTime = (d: string) =>
  `${fmtDate(d)}, ${new Date(d).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;

const digits = (s?: string) => (s || "").replace(/\D/g, "");
// Last 10 digits, so "+91 96569 08009" and "09656908009" both match.
export const normPhone = (s?: string) => digits(s).slice(-10);
export const looksLikePhone = (s: string) =>
  /^[+\d\s()-]+$/.test(s) && digits(s).length >= 3;

export const waLink = (o: Order) => {
  const name = o.customerName?.split(" ")[0] || "there";
  const lines = (o.items || [])
    .map((it, i) => {
      const price = it.isFreeItem ? "FREE" : `₹${it.price}`;
      // Schema has no slug, so this uses the product id. Match your route.
      const url = it.productId
        ? `\n   🔗 https://whitewalk.in/product/${it.productId}`
        : "";
      return `${i + 1}. ${it.productName} (Size ${it.size}) - ${price}${url}`;
    })
    .join("\n");
  const msg = `Hi ${name}! 👋
Saw you were ordering:
${lines}

Total: ₹${o.totalAmount} 👟
Are you still planning to order?
Reply here, we'll confirm it right away.
Stock is limited!

🎁 More offers: https://whitewalk.in/offer`;
  return `https://wa.me/91${normPhone(o.contact1)}?text=${encodeURIComponent(msg)}`;
};

/* ---------- badges ---------- */

export const StatusBadge = ({ status }: { status: Fulfillment }) => {
  const { style, Icon } = STATUS[status] ?? STATUS.pending;
  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-extrabold tracking-tight ${style}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {cap(status)}
    </span>
  );
};

export const PayBadge = ({ status }: { status: PaymentStatus }) => (
  <span
    className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-xs font-extrabold tracking-tight ${
      PAY_STYLE[status] ?? "bg-neutral-100 text-neutral-600"
    }`}
  >
    {PAY_LABEL[status] ?? status}
  </span>
);

export const MethodTag = ({ method }: { method: Order["shippingMethod"] }) =>
  method === "cod" ? (
    <Tag className="bg-amber-50 text-amber-700">COD</Tag>
  ) : (
    <Tag className={BLUE_TAG}>Prepaid</Tag>
  );

export const Addons = ({ order }: { order: Order }) => (
  <>
    {order.shoeCleanerAddon && <Tag>Cleaner</Tag>}
    {order.freeSocksOffer && <Tag>Free socks</Tag>}
  </>
);

export const WaButton = ({ order }: { order: Order }) => (
  <a
    href={waLink(order)}
    target="_blank"
    rel="noreferrer"
    onClick={(e) => e.stopPropagation()}
    title="Message on WhatsApp"
    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-green-50 px-3 text-xs font-extrabold tracking-tight text-green-700 transition-all hover:bg-green-100 active:scale-95"
  >
    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
  </a>
);