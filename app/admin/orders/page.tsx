/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/orders/page.tsx
"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Bell,
  BellOff,
  Loader2,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  ImageIcon,
  MessageCircle,
} from "lucide-react";
import { client as sanityClient } from "@/lib/sanity";
import { Button } from "@/components/ui/button";

/* ---------- types & constants ---------- */

interface OrderItem {
  productName: string;
  size: number; // schema: number
  price: number;
  isFreeItem: boolean;
  imageUrl?: string | null; // resolved from the image asset in QUERY
  productId?: string | null; // product reference id
}

type Fulfillment =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

type PaymentStatus =
  | "verifying"
  | "paid"
  | "pending"
  | "rejected"
  | "failed"
  | "refunded";

interface Order {
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

type Tab = "orders" | "abandoned";
type MethodFilter = "all" | Order["shippingMethod"];

// imageUrl / paymentScreenshot are Sanity image objects, so resolve them to
// CDN URLs here. "auto=format" is also what copyImage() swaps for "fm=png".
const QUERY = `*[_type == "order"] | order(createdAt desc) {
  ...,
  "paymentScreenshotUrl": paymentScreenshot.asset->url,
  items[]{
    productName,
    size,
    price,
    isFreeItem,
    "imageUrl": imageUrl.asset->url + "?w=200&auto=format",
    "productId": product._ref
  }
}`;

const STATUS: Record<Fulfillment, { style: string; Icon: any }> = {
  pending: { style: "bg-gray-100 text-gray-800", Icon: Clock },
  processing: { style: "bg-amber-100 text-amber-800", Icon: Package },
  shipped: { style: "bg-blue-100 text-blue-800", Icon: Truck },
  delivered: { style: "bg-green-100 text-green-800", Icon: CheckCircle2 },
  cancelled: { style: "bg-red-100 text-red-800", Icon: XCircle },
};
const STATUSES = Object.keys(STATUS) as Fulfillment[];

const PAY_STYLE: Record<PaymentStatus, string> = {
  verifying: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};
const PAY_LABEL: Record<PaymentStatus, string> = {
  verifying: "Awaiting verification",
  paid: "Paid",
  pending: "Pending",
  rejected: "Rejected",
  failed: "Failed",
  refunded: "Refunded",
};
const PAY_STATUSES = Object.keys(PAY_LABEL) as PaymentStatus[];

const COD_ADVANCE = 300;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
// "verifying" and "rejected" are real (UPI) orders, so they stay in the Orders tab.
const isAbandoned = (o: Order) =>
  o.paymentStatus === "pending" || o.paymentStatus === "failed";
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const fmtDateTime = (d: string) =>
  `${fmtDate(d)}, ${new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;

/* ---------- phone helpers ---------- */

const digitsOnly = (s?: string) => (s || "").replace(/\D/g, "");
// Keep last 10 digits so "+91 96569 08009", "09656908009" and "9656908009" all match.
const normPhone = (s?: string) => {
  const d = digitsOnly(s);
  return d.length > 10 ? d.slice(-10) : d;
};
const looksLikePhone = (s: string) =>
  /^[+\d\s()-]+$/.test(s) && digitsOnly(s).length >= 3;

/* ---------- whatsapp helpers ---------- */

const waLink = (o: Order) => {
  const name = o.customerName?.split(" ")[0] || "there";
  const lines = (o.items || [])
    .map((it, i) => {
      const price = it.isFreeItem ? "FREE" : `₹${it.price}`;
      // The schema has no slug field, so this uses the product id.
      // Change this URL to match your storefront's product route.
      const url = it.productId
        ? `\n   🔗 https://footex.in/product/${it.productId}`
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

🎁 More offers: https://footex.in/offer`;
  return `https://wa.me/91${normPhone(o.contact1)}?text=${encodeURIComponent(msg)}`;
};

const WaButton = ({ order }: { order: Order }) => (
  <a
    href={waLink(order)}
    target="_blank"
    rel="noreferrer"
    onClick={(e) => e.stopPropagation()}
    title="Message on WhatsApp"
    className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold hover:bg-green-200"
  >
    <MessageCircle className="h-3 w-3" /> WhatsApp
  </a>
);

const INPUT =
  "w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const LABEL = "block text-sm font-semibold text-muted-foreground mb-1";
const SELECT =
  "text-xs md:text-sm rounded-full bg-muted font-semibold px-2 py-1";
const TH =
  "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
const CHECK = "h-4 w-4 rounded border-gray-300 cursor-pointer accent-blue-600";

type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "custom";

const DATE_PRESETS: [DatePreset, string][] = [
  ["all", "Any date"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["month", "This month"],
  ["custom", "Pick dates…"],
];

const METHOD_OPTIONS: [MethodFilter, string][] = [
  ["all", "COD & Prepaid"],
  ["cod", "COD only"],
  ["online", "Prepaid only"],
];

const DAY = 86400000;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function getRange(preset: DatePreset, from: string, to: string) {
  const now = new Date();
  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { from: today, to: today + DAY - 1 };
    case "yesterday":
      return { from: today - DAY, to: today - 1 };
    case "7d":
      return { from: today - 6 * DAY, to: null };
    case "30d":
      return { from: today - 29 * DAY, to: null };
    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        to: null,
      };
    case "custom":
      return {
        from: from ? new Date(`${from}T00:00:00`).getTime() : null,
        to: to ? new Date(`${to}T23:59:59.999`).getTime() : null,
      };
    default:
      return { from: null, to: null };
  }
}

/* ---------- small components ---------- */

const Chip = ({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
  >
    {children}
  </span>
);

const StatusBadge = ({ status }: { status: Fulfillment }) => {
  const { style, Icon } = STATUS[status] ?? STATUS.pending;
  return (
    <Chip className={style}>
      <Icon className="h-3 w-3" />
      {cap(status)}
    </Chip>
  );
};

const PayBadge = ({ status }: { status: PaymentStatus }) => (
  <Chip className={PAY_STYLE[status] ?? "bg-gray-100 text-gray-800"}>
    {PAY_LABEL[status] ?? status}
  </Chip>
);

const Addons = ({ order }: { order: Order }) => (
  <>
    {order.shoeCleanerAddon && (
      <Chip className="bg-purple-100 text-purple-800">Cleaner</Chip>
    )}
    {order.freeSocksOffer && (
      <Chip className="bg-pink-100 text-pink-800">Free Socks</Chip>
    )}
  </>
);

function Thumb({
  url,
  alt,
  size = "h-10 w-10",
}: {
  url?: string | null;
  alt?: string;
  size?: string;
}) {
  const [broken, setBroken] = useState(false);
  return url && !broken ? (
    <img
      src={url}
      alt={alt}
      onError={() => setBroken(true)}
      className={`${size} rounded-lg object-cover border bg-gray-100 shrink-0`}
    />
  ) : (
    <div
      className={`${size} rounded-lg bg-gray-100 shrink-0 flex items-center justify-center`}
    >
      <ImageIcon className="h-4 w-4 text-gray-400" />
    </div>
  );
}

/* ---------- order list (table on desktop, cards on mobile) ---------- */

function OrderList({
  orders,
  onOpen,
  selectable,
  selected,
  onToggle,
  onTogglePage,
}: {
  orders: Order[];
  onOpen: (id: string, confirm?: boolean) => void;
  selectable: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onTogglePage: () => void;
}) {
  const del = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onOpen(id, true);
  };
  const first = (o: Order) => o.items?.[0];
  const allOnPage =
    orders.length > 0 && orders.every((o) => selected.has(o._id));
  const someOnPage = orders.some((o) => selected.has(o._id));

  return (
    <>
      <div className="md:hidden divide-y divide-muted">
        {selectable && orders.length > 0 && (
          <label className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <input
              type="checkbox"
              className={CHECK}
              checked={allOnPage}
              ref={(el) => {
                if (el) el.indeterminate = !allOnPage && someOnPage;
              }}
              onChange={onTogglePage}
            />
            Select page
          </label>
        )}
        {orders.map((o) => (
          <div
            key={o._id}
            className={`flex items-start ${selected.has(o._id) ? "bg-blue-50" : ""}`}
          >
            {selectable && (
              <label className="pl-3 pt-4 pr-1 cursor-pointer">
                <input
                  type="checkbox"
                  className={CHECK}
                  checked={selected.has(o._id)}
                  onChange={() => onToggle(o._id)}
                />
              </label>
            )}
            <button
              onClick={() => onOpen(o._id)}
              className="flex-1 min-w-0 text-left p-3 hover:bg-gray-50"
            >
              <div className="flex items-start gap-3">
                <Thumb url={first(o)?.imageUrl} alt={first(o)?.productName} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {o.customerName} • ₹{o.totalAmount}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {o.orderId} • {o.items?.length || 0} item(s) •{" "}
                    {fmtDate(o.createdAt)}
                  </div>
                  <div className="flex gap-1 flex-wrap mt-1">
                    <Chip
                      className={
                        o.shippingMethod === "cod"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-sky-100 text-sky-800"
                      }
                    >
                      {o.shippingMethod === "cod" ? "COD" : "Prepaid"}
                    </Chip>
                    {o.paymentStatus !== "paid" && !isAbandoned(o) && (
                      <PayBadge status={o.paymentStatus} />
                    )}
                    <Addons order={o} />
                  </div>
                </div>
                {isAbandoned(o) ? (
                  <PayBadge status={o.paymentStatus} />
                ) : (
                  <StatusBadge status={o.fulfillmentStatus} />
                )}
              </div>
            </button>
            {isAbandoned(o) && (
              <div className="pr-3 pt-3">
                <WaButton order={o} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="pl-4 py-2 w-8">
                  <input
                    type="checkbox"
                    className={CHECK}
                    checked={allOnPage}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPage && someOnPage;
                    }}
                    onChange={onTogglePage}
                    aria-label="Select page"
                  />
                </th>
              )}
              {[
                "Item",
                "Order",
                "Customer",
                "Total",
                "Method",
                "Add-ons",
                "Payment",
                "Fulfillment",
                "Date",
                "",
              ].map((h, i) => (
                <th key={i} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((o) => (
              <tr
                key={o._id}
                onClick={() => onOpen(o._id)}
                className={`cursor-pointer hover:bg-gray-50 text-sm ${selected.has(o._id) ? "bg-blue-50" : ""}`}
              >
                {selectable && (
                  <td
                    className="pl-4 py-3 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={CHECK}
                      checked={selected.has(o._id)}
                      onChange={() => onToggle(o._id)}
                      aria-label={`Select ${o.orderId}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Thumb url={first(o)?.imageUrl} alt={first(o)?.productName} />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {o.orderId}
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate">
                  {o.customerName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  ₹{o.totalAmount}
                </td>
                <td className="px-4 py-3">
                  <Chip
                    className={
                      o.shippingMethod === "cod"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-sky-100 text-sky-800"
                    }
                  >
                    {o.shippingMethod === "cod" ? "COD" : "Prepaid"}
                  </Chip>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <Addons order={o} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PayBadge status={o.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.fulfillmentStatus} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDate(o.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isAbandoned(o) && <WaButton order={o} />}
                    <button
                      onClick={(e) => del(e, o._id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete order"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- order modal ---------- */

function OrderModal({
  order,
  startConfirm,
  onClose,
  onChange,
}: {
  order: Order;
  startConfirm?: boolean;
  onClose: () => void;
  onChange: () => void;
}) {
  const [form, setForm] = useState({
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    courierName: order.courierName || "",
    trackingNumber: order.trackingNumber || "",
    trackingUrl: order.trackingUrl || "",
    adminNotes: order.adminNotes || "",
  });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(!!startConfirm);
  const [copied, setCopied] = useState<"addr" | number | null>(null);

  const flash = (k: "addr" | number) => {
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };
  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: any) => setForm({ ...form, [k]: e.target.value }),
  });

  const run = async (kind: "save" | "delete", fn: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await fn();
      onChange();
      onClose();
    } catch (e) {
      console.error(e);
      alert(`Failed to ${kind} order`);
      setBusy(null);
    }
  };

  const save = () =>
    run("save", () => {
      // .set() ignores undefined, so cleared fields are .unset()
      const set: Record<string, unknown> = {
        fulfillmentStatus: form.fulfillmentStatus,
        paymentStatus: form.paymentStatus,
      };
      const unset: string[] = [];
      for (const k of [
        "courierName",
        "trackingNumber",
        "trackingUrl",
        "adminNotes",
      ] as const) {
        const v = form[k].trim();
        if (v) set[k] = v;
        else unset.push(k);
      }
      let patch = sanityClient.patch(order._id).set(set);
      if (unset.length) patch = patch.unset(unset);
      return patch.commit();
    });

  const copyAddress = async () => {
    const sizes = order.items
      .map((it, i) => `SIZE PAIR ${i + 1}= ${it.size}`)
      .join("\n");
    const collect =
      order.remainingAmount ?? Math.max(0, order.totalAmount - COD_ADVANCE);
    const advance = order.advancePaid ?? COD_ADVANCE;
    const text = `NAME : ${order.customerName}
ADDRESS : ${order.address}${order.landmark ? ", " + order.landmark : ""}
CITY : ${order.district}
DISTRICT : ${order.district}
STATE : ${order.state}
PINCODE : ${order.pincode}
CONTACT NO 1 : ${order.contact1}
SECOND NO 2 : ${order.contact2 || ""}
${sizes}
SHOE CLEANER : ${order.shoeCleanerAddon ? "YES" : "NO"}
\nPAYMENT : ${order.shippingMethod === "cod" ? `COD - collect ₹${collect} (₹${advance} advance paid)` : "PREPAID"}
`;
    try {
      await navigator.clipboard.writeText(text);
      flash("addr");
    } catch {
      alert("Failed to copy. Try again.");
    }
  };

  const copyImage = async (url: string, i: number) => {
    try {
      // Force PNG — ClipboardItem doesn't reliably accept webp/jpeg.
      const blob = await (
        await fetch(url.replace(/auto=format/g, "fm=png"))
      ).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      flash(i);
    } catch {
      alert("Failed to copy image. Your browser may not support this.");
    }
  };

  const methodLabel =
    order.paymentMethod === "manual_upi"
      ? "Manual UPI"
      : order.paymentMethod === "razorpay"
        ? "Razorpay"
        : "—";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight">
              Order {order.orderId}
            </h3>
            <p className="text-xs text-muted-foreground">
              {fmtDateTime(order.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setConfirm(true)}
              variant="ghost"
              size="icon"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete order"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button onClick={onClose} variant="ghost" size="icon">
              <X />
            </Button>
          </div>
        </div>

        {confirm && (
          <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-sm">
            <p className="font-semibold text-red-800 mb-2">
              Delete order {order.orderId}? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setConfirm(false)}
                variant="outline"
                size="sm"
                disabled={!!busy}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  run("delete", () => sanityClient.delete(order._id))
                }
                variant="destructive"
                size="sm"
                disabled={!!busy}
                className="gap-2"
              >
                {busy === "delete" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="mb-4 space-y-2">
          {order.items?.map((it, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="relative group/img">
                <Thumb
                  url={it.imageUrl}
                  alt={it.productName}
                  size="h-12 w-12"
                />
                {it.imageUrl && (
                  <button
                    onClick={() => copyImage(it.imageUrl!, i)}
                    title="Copy image"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white border shadow flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    {copied === i ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <ImageIcon className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
              <div className="flex-1 flex justify-between items-center gap-2">
                <span>
                  {it.productName} (Size {it.size}){" "}
                  {it.isFreeItem && (
                    <span className="text-green-600 font-medium">FREE</span>
                  )}
                </span>
                <span className="whitespace-nowrap">
                  ₹{it.isFreeItem ? 0 : it.price}
                </span>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold pt-1 border-t">
            <span>Total</span>
            <span>₹{order.totalAmount}</span>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm space-y-1 relative">
          <Button
            onClick={copyAddress}
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 h-7 px-2 text-xs gap-1"
          >
            {copied === "addr" ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </Button>
          <p className="font-semibold pr-20">{order.customerName}</p>
          <p className="text-muted-foreground">
            {[order.contact1, order.contact2].filter(Boolean).join(", ")}
          </p>
          <p className="text-muted-foreground">
            {[order.address, order.landmark, order.district]
              .filter(Boolean)
              .join(", ")}
            , {order.state} - {order.pincode}
          </p>
          {order.instagramId && (
            <p className="text-muted-foreground">@{order.instagramId}</p>
          )}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <PayBadge status={order.paymentStatus} />
            <span className="text-xs text-muted-foreground">
              {order.shippingMethod === "online" ? "Prepaid" : "COD"}
            </span>
            <Addons order={order} />
            {order.razorpayPaymentId && (
              <span className="text-xs text-muted-foreground truncate">
                {order.razorpayPaymentId}
              </span>
            )}
          </div>
          {isAbandoned(order) && (
            <div className="pt-2">
              <WaButton order={order} />
            </div>
          )}
        </div>

        {/* Payment details + verification */}
        <div className="mb-4 p-3 rounded-xl border text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Method</span>
            <span>{methodLabel}</span>
          </div>
          {order.pairCount ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Offer</span>
              <span>{order.pairCount} {order.pairCount === 1 ? "pair" : "pairs"}</span>
            </div>
          ) : null}
          {order.advancePaid != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid now</span>
              <span>₹{order.advancePaid}</span>
            </div>
          )}
          {order.remainingAmount ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Collect on delivery</span>
              <span>₹{order.remainingAmount}</span>
            </div>
          ) : null}
          {order.utr && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">UTR</span>
              <span className="font-mono">{order.utr}</span>
            </div>
          )}
          {order.paymentScreenshotUrl && (
            <a
              href={order.paymentScreenshotUrl}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <img
                src={`${order.paymentScreenshotUrl}?w=600&auto=format`}
                alt="Payment screenshot"
                className="rounded-lg border max-h-64 w-full object-contain bg-gray-50"
              />
            </a>
          )}

          <div>
            <label className={LABEL}>Payment Status</label>
            <select {...field("paymentStatus")} className={INPUT}>
              {PAY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAY_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          {order.paymentStatus === "verifying" && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={() =>
                  setForm({
                    ...form,
                    paymentStatus: "paid",
                    fulfillmentStatus: "processing",
                  })
                }
              >
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() =>
                  setForm({
                    ...form,
                    paymentStatus: "rejected",
                    fulfillmentStatus: "cancelled",
                  })
                }
              >
                Reject
              </Button>
            </div>
          )}
          {order.paymentStatus === "verifying" && (
            <p className="text-xs text-muted-foreground">
              Approve or Reject fills the form. Press Save Changes to apply it.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL}>Fulfillment Status</label>
            <select {...field("fulfillmentStatus")} className={INPUT}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Courier</label>
              <input
                type="text"
                placeholder="e.g. Delhivery"
                className={INPUT}
                {...field("courierName")}
              />
            </div>
            <div>
              <label className={LABEL}>Tracking Number</label>
              <input
                type="text"
                placeholder="AWB / tracking ID"
                className={INPUT}
                {...field("trackingNumber")}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Tracking URL</label>
            <input
              type="url"
              placeholder="https://..."
              className={INPUT}
              {...field("trackingUrl")}
            />
            {form.trackingUrl && (
              <a
                href={form.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1"
              >
                Open tracking link <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div>
            <label className={LABEL}>Admin Notes</label>
            <textarea
              rows={2}
              placeholder="Internal notes about this order..."
              className={INPUT}
              {...field("adminNotes")}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 md:gap-3 mt-6 pt-4 border-t sticky bottom-0 bg-white">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            variant="secondary"
            disabled={!!busy}
            className="gap-2 w-full sm:w-auto"
          >
            {busy === "save" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("orders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Fulfillment>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatus>(
    "all",
  );
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Fulfillment>("processing");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Store only the id so the modal always reflects the latest fetched data.
  const [open, setOpen] = useState<{ id: string; confirm?: boolean } | null>(
    null,
  );
  const selected = useMemo(
    () => orders.find((o) => o._id === open?.id) ?? null,
    [orders, open],
  );

  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [sound, setSound] = useState(true);
  const [banner, setBanner] = useState<Order | null>(null);
  const knownIds = useRef(new Set<string>());
  const audio = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const fetchOrders = useCallback(async () => {
    try {
      const data = await sanityClient.fetch<Order[]>(
        QUERY,
        {},
        { cache: "no-store" },
      );
      setOrders(data);
      knownIds.current = new Set(data.map((o) => o._id));
      // Drop selections for orders that no longer exist.
      setSelectedIds((prev) => {
        const live = new Set(data.map((o) => o._id));
        const next = new Set([...prev].filter((id) => live.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch (e) {
      console.error("Error fetching orders:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNotifPerm(
      "Notification" in window ? Notification.permission : "unsupported",
    );
    audio.current = new Audio("/notification.mp3");
    fetchOrders();
  }, [fetchOrders]);

  // Realtime: refetch on any change so projections + payment flips stay fresh.
  useEffect(() => {
    const sub = sanityClient
      .listen(`*[_type == "order"]`, {}, { includeResult: true })
      .subscribe((u: any) => {
        const raw = u.result as Order | undefined;
        const isNew =
          u.transition === "appear" && raw && !knownIds.current.has(raw._id);
        if (isNew) knownIds.current.add(raw._id);
        fetchOrders();
        if (!isNew) return;

        setBanner(raw);
        if (soundRef.current) audio.current?.play().catch(() => {});
        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("New order received", {
            body: `${raw.customerName} • ₹${raw.totalAmount}`,
            tag: raw._id,
          });
        }
      });
    return () => sub.unsubscribe();
  }, [fetchOrders]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 8000);
    return () => clearTimeout(t);
  }, [banner]);

  const abandonedCount = useMemo(
    () => orders.filter(isAbandoned).length,
    [orders],
  );
  const paidCount = useMemo(
    () => orders.filter((o) => !isAbandoned(o)).length,
    [orders],
  );
  const verifyingCount = useMemo(
    () => orders.filter((o) => o.paymentStatus === "verifying").length,
    [orders],
  );

  const { rows, totalPages, count, allIds } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const phoneSearch = term && looksLikePhone(term);
    const qPhone = phoneSearch ? normPhone(term) : "";
    const { from, to } = getRange(datePreset, dateFrom, dateTo);

    const filtered = orders.filter((o) => {
      if (tab === "abandoned") {
        if (!isAbandoned(o)) return false;
      } else {
        if (isAbandoned(o)) return false;
        if (statusFilter !== "all" && o.fulfillmentStatus !== statusFilter)
          return false;
        if (paymentFilter !== "all" && o.paymentStatus !== paymentFilter)
          return false;
      }

      if (methodFilter !== "all" && o.shippingMethod !== methodFilter)
        return false;

      const t = new Date(o.createdAt).getTime();
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;

      return (
        !term ||
        o.orderId?.toLowerCase().includes(term) ||
        o.customerName?.toLowerCase().includes(term) ||
        o.contact1?.includes(term) ||
        o.contact2?.includes(term) ||
        (phoneSearch &&
          (normPhone(o.contact1).includes(qPhone) ||
            normPhone(o.contact2).includes(qPhone))) ||
        o.utr?.toLowerCase().includes(term) ||
        o.razorpayPaymentId?.toLowerCase().includes(term) ||
        o.trackingNumber?.toLowerCase().includes(term)
      );
    });
    const pages = Math.max(1, Math.ceil(filtered.length / perPage));
    const start = (Math.min(page, pages) - 1) * perPage;
    return {
      rows: filtered.slice(start, start + perPage),
      totalPages: pages,
      count: filtered.length,
      allIds: filtered.map((o) => o._id),
    };
  }, [
    orders,
    tab,
    search,
    statusFilter,
    paymentFilter,
    methodFilter,
    datePreset,
    dateFrom,
    dateTo,
    page,
    perPage,
  ]);

  const current = Math.min(page, totalPages);
  const firstPageNum = Math.max(1, Math.min(current - 2, totalPages - 4));
  const pageNums = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => firstPageNum + i,
  );

  const goTo = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const toggleAlerts = async () => {
    if (notifPerm === "granted") return setSound((s) => !s);
    if ("Notification" in window)
      setNotifPerm(await Notification.requestPermission());
  };

  /* ----- bulk actions ----- */

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = rows.every((o) => next.has(o._id));
      rows.forEach((o) => (all ? next.delete(o._id) : next.add(o._id)));
      return next;
    });

  const selectAllMatching = () => setSelectedIds(new Set(allIds));
  const clearSelection = () => setSelectedIds(new Set());

  const applyBulkStatus = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(`Mark ${ids.length} order(s) as ${cap(bulkStatus)}?`))
      return;
    setBulkBusy(true);
    try {
      const tx = sanityClient.transaction();
      ids.forEach((id) =>
        tx.patch(id, (p: any) => p.set({ fulfillmentStatus: bulkStatus })),
      );
      await tx.commit();
      await fetchOrders();
      clearSelection();
    } catch (e) {
      console.error(e);
      alert("Failed to update orders");
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const alertsOn = notifPerm === "granted" && sound;
  const hasActiveFilters =
    !!search ||
    datePreset !== "all" ||
    methodFilter !== "all" ||
    (tab === "orders" && (statusFilter !== "all" || paymentFilter !== "all"));

  return (
    <div className="space-y-4 md:space-y-6 md:p-4 bg-primary">
      {banner && (
        <div className="fixed top-4 right-4 z-[60] bg-white border border-green-200 shadow-xl rounded-2xl p-4 max-w-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-green-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">New order received</p>
              <p className="text-xs text-muted-foreground truncate">
                {banner.customerName} • ₹{banner.totalAmount}
              </p>
              <button
                onClick={() => {
                  setOpen({ id: banner._id });
                  setBanner(null);
                }}
                className="text-xs font-semibold text-blue-600 mt-1"
              >
                View order →
              </button>
            </div>
            <button onClick={() => setBanner(null)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {selected && (
        <OrderModal
          key={selected._id}
          order={selected}
          startConfirm={open?.confirm}
          onClose={() => setOpen(null)}
          onChange={fetchOrders}
        />
      )}

      <div>
        <div className="bg-white rounded-t-3xl p-4 flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            {(
              [
                ["orders", "Orders", paidCount],
                ["abandoned", "Abandoned carts", abandonedCount],
              ] as const
            ).map(([key, label, n]) => (
              <Button
                key={key}
                onClick={() => {
                  setTab(key);
                  setPage(1);
                  clearSelection();
                }}
                variant={tab === key ? "secondary" : "ghost"}
                size="sm"
                className="rounded-full gap-2"
              >
                {label}
                <span className="text-xs opacity-70">{n}</span>
              </Button>
            ))}
            {verifyingCount > 0 && (
              <Button
                onClick={() => {
                  setTab("orders");
                  setPaymentFilter("verifying");
                  setPage(1);
                  clearSelection();
                }}
                variant="outline"
                size="sm"
                className="rounded-full gap-2 border-blue-300 text-blue-800"
              >
                Needs verification
                <span className="text-xs font-bold">{verifyingCount}</span>
              </Button>
            )}
          </div>

          <div className="flex items-center w-full gap-2">
            <Button
              onClick={toggleAlerts}
              variant="outline"
              className="gap-2 shrink-0 px-2 sm:px-4 text-xs sm:text-sm"
            >
              {alertsOn ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {notifPerm !== "granted"
                  ? "Enable alerts"
                  : sound
                    ? "Alerts on"
                    : "Sound off"}
              </span>
            </Button>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 md:h-5 md:w-5" />
              <input
                type="text"
                placeholder="Search by order ID, customer, phone, UTR or tracking ID..."
                value={search}
                onChange={(e) => reset(setSearch)(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm md:text-base bg-muted rounded-2xl focus:ring-2 text-muted-foreground font-semibold focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs md:text-sm text-muted-foreground font-semibold">
              {count} of {tab === "abandoned" ? abandonedCount : paidCount}{" "}
              {tab === "abandoned" ? "abandoned carts" : "orders"}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={methodFilter}
                onChange={(e) =>
                  reset(setMethodFilter)(e.target.value as MethodFilter)
                }
                className={SELECT}
                aria-label="Filter by payment method"
              >
                {METHOD_OPTIONS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={datePreset}
                onChange={(e) =>
                  reset(setDatePreset)(e.target.value as DatePreset)
                }
                className={SELECT}
                aria-label="Filter by date"
              >
                {DATE_PRESETS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              {datePreset === "custom" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                    From
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => reset(setDateFrom)(e.target.value)}
                      className={SELECT}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                    To
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => reset(setDateTo)(e.target.value)}
                      className={SELECT}
                    />
                  </label>
                </div>
              )}
              {tab === "orders" && (
                <>
                  <select
                    value={paymentFilter}
                    onChange={(e) =>
                      reset(setPaymentFilter)(e.target.value as any)
                    }
                    className={SELECT}
                    aria-label="Filter by payment status"
                  >
                    <option value="all">All payments</option>
                    {PAY_STATUSES.filter(
                      (s) => s !== "pending" && s !== "failed",
                    ).map((s) => (
                      <option key={s} value={s}>
                        {PAY_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      reset(setStatusFilter)(e.target.value as any)
                    }
                    className={SELECT}
                    aria-label="Filter by fulfillment status"
                  >
                    <option value="all">All statuses</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {cap(s)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <select
                value={perPage}
                onChange={(e) => reset(setPerPage)(Number(e.target.value))}
                className={SELECT}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tab === "orders" && selectedIds.size > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-2xl bg-blue-50 border border-blue-200">
              <div className="text-sm font-semibold text-blue-900 flex items-center gap-3 flex-wrap">
                <span>{selectedIds.size} selected</span>
                {selectedIds.size < allIds.length && (
                  <button
                    onClick={selectAllMatching}
                    className="text-xs text-blue-600 underline"
                  >
                    Select all {allIds.length}
                  </button>
                )}
                <button
                  onClick={clearSelection}
                  className="text-xs text-blue-600 underline"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as Fulfillment)}
                  className={SELECT}
                  disabled={bulkBusy}
                  aria-label="Bulk fulfillment status"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {cap(s)}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={applyBulkStatus}
                  size="sm"
                  variant="secondary"
                  disabled={bulkBusy}
                  className="gap-2"
                >
                  {bulkBusy ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white overflow-hidden">
          <OrderList
            orders={rows}
            onOpen={(id, confirm) => setOpen({ id, confirm })}
            selectable={tab === "orders"}
            selected={selectedIds}
            onToggle={toggleOne}
            onTogglePage={togglePage}
          />

          {rows.length === 0 && (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-2 font-semibold">
                {tab === "abandoned" ? "No abandoned carts" : "No orders found"}
              </div>
              {hasActiveFilters && (
                <Button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setPaymentFilter("all");
                    setMethodFilter("all");
                    setDatePreset("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  variant="outline"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white md:rounded-b-3xl p-4">
            <div className="text-sm text-muted-foreground font-semibold">
              Page {current} of {totalPages}
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                onClick={() => goTo(current - 1)}
                disabled={current === 1}
                variant="outline"
                size="icon"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageNums.map((n) => (
                <Button
                  key={n}
                  onClick={() => goTo(n)}
                  variant="ghost"
                  size="icon"
                  className={`text-sm ${current === n ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
                >
                  {n}
                </Button>
              ))}
              <Button
                onClick={() => goTo(current + 1)}
                disabled={current === totalPages}
                variant="outline"
                size="icon"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}