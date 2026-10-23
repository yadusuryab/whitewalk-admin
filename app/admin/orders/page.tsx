/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/orders/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Inter_Tight } from "next/font/google";
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

const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "800"],
  display: "swap",
});

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
  pending: { style: "bg-neutral-100 text-neutral-600", Icon: Clock },
  processing: { style: "bg-amber-50 text-amber-700", Icon: Package },
  shipped: { style: "bg-blue-600/10 text-blue-700", Icon: Truck },
  delivered: { style: "bg-green-50 text-green-700", Icon: CheckCircle2 },
  cancelled: { style: "bg-red-50 text-red-600", Icon: XCircle },
};
const STATUSES = Object.keys(STATUS) as Fulfillment[];

const PAY_STYLE: Record<PaymentStatus, string> = {
  verifying: "bg-blue-600/10 text-blue-700",
  paid: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
  failed: "bg-red-50 text-red-600",
  refunded: "bg-neutral-100 text-neutral-600",
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

/* ---------- UI atoms ---------- */

const inputCls =
  "w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium outline-none transition-all duration-300 placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-950";
const inputLg = `${inputCls} h-12 py-0`;
const labelCls = "mb-2 block text-sm font-semibold text-neutral-500";
const selectCls =
  "h-9 cursor-pointer rounded-full bg-neutral-100 px-3 text-xs font-semibold outline-none transition-all focus:ring-2 focus:ring-neutral-950";
const thCls =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400";
const checkCls =
  "h-4 w-4 cursor-pointer rounded accent-neutral-950";

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "soft" | "danger";
  icon?: boolean;
  className?: string;
  title?: string;
  type?: "button" | "submit";
};

const Btn = ({
  children,
  onClick,
  disabled,
  variant = "soft",
  icon,
  className = "",
  title,
  type = "button",
}: BtnProps) => {
  const v = {
    primary: "bg-neutral-950 text-white hover:bg-blue-600",
    soft: "bg-neutral-100 text-neutral-950 hover:bg-neutral-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      aria-label={icon ? title : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-extrabold tracking-tight transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
        icon ? "w-10" : "px-5"
      } ${v} ${className}`}
    >
      {children}
    </button>
  );
};

const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold tracking-tight transition-all duration-200 active:scale-90 ${
      active
        ? "bg-neutral-950 text-white"
        : "bg-neutral-100 hover:bg-neutral-200"
    }`}
  >
    {children}
  </button>
);

const Tag = ({
  children,
  className = "bg-neutral-100 text-neutral-600",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${className}`}
  >
    {children}
  </span>
);

const StatusBadge = ({ status }: { status: Fulfillment }) => {
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

const PayBadge = ({ status }: { status: PaymentStatus }) => (
  <span
    className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-xs font-extrabold tracking-tight ${
      PAY_STYLE[status] ?? "bg-neutral-100 text-neutral-600"
    }`}
  >
    {PAY_LABEL[status] ?? status}
  </span>
);

const MethodTag = ({ method }: { method: Order["shippingMethod"] }) =>
  method === "cod" ? (
    <Tag className="bg-amber-50 text-amber-700">COD</Tag>
  ) : (
    <Tag className="bg-blue-600/10 text-blue-700">Prepaid</Tag>
  );

const Addons = ({ order }: { order: Order }) => (
  <>
    {order.shoeCleanerAddon && <Tag>Cleaner</Tag>}
    {order.freeSocksOffer && <Tag>Free socks</Tag>}
  </>
);

const WaButton = ({ order }: { order: Order }) => (
  <a
    href={waLink(order)}
    target="_blank"
    rel="noreferrer"
    onClick={(e) => e.stopPropagation()}
    title="Message on WhatsApp"
    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-green-50 px-3 text-xs font-extrabold tracking-tight text-green-700 transition-all duration-300 hover:bg-green-100 active:scale-95"
  >
    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
  </a>
);

function Thumb({
  url,
  alt,
  size = "h-12 w-12",
}: {
  url?: string | null;
  alt?: string;
  size?: string;
}) {
  const [broken, setBroken] = useState(false);
  return url && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      onError={() => setBroken(true)}
      className={`${size} shrink-0 rounded-2xl bg-white object-cover`}
    />
  ) : (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-white`}
    >
      <ImageIcon className="h-5 w-5 text-neutral-300" />
    </div>
  );
}

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
      <div className="space-y-3 md:hidden">
        {selectable && orders.length > 0 && (
          <label className="flex items-center gap-3 px-2 text-xs font-semibold text-neutral-500">
            <input
              type="checkbox"
              className={checkCls}
              checked={allOnPage}
              ref={(el) => {
                if (el) el.indeterminate = !allOnPage && someOnPage;
              }}
              onChange={onTogglePage}
            />
            Select page
          </label>
        )}
        {orders.map((o, i) => (
          <div
            key={o._id}
            style={{
              animationDelay: `${(i % 10) * 45}ms`,
              animationFillMode: "both",
            }}
            className={`flex items-start rounded-[1.75rem] duration-500 animate-in fade-in slide-in-from-bottom-3 ${
              selected.has(o._id) ? "bg-blue-600/10" : "bg-neutral-100"
            }`}
          >
            {selectable && (
              <label className="cursor-pointer pb-3 pl-4 pr-1 pt-5">
                <input
                  type="checkbox"
                  className={checkCls}
                  checked={selected.has(o._id)}
                  onChange={() => onToggle(o._id)}
                />
              </label>
            )}
            <button
              onClick={() => onOpen(o._id)}
              className="min-w-0 flex-1 p-3 text-left"
            >
              <div className="flex items-start gap-3">
                <Thumb
                  url={first(o)?.imageUrl}
                  alt={first(o)?.productName}
                  size="h-20 w-20"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400">
                    {o.orderId}
                  </p>
                  <p className="truncate text-base font-extrabold leading-tight tracking-tight">
                    {o.customerName}
                  </p>
                  <p className="text-2xl font-extrabold leading-none tracking-[-0.04em]">
                    ₹{o.totalAmount}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-neutral-400">
                    {o.items?.length || 0} item(s) · {fmtDate(o.createdAt)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <MethodTag method={o.shippingMethod} />
                    <Addons order={o} />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isAbandoned(o) ? (
                  <PayBadge status={o.paymentStatus} />
                ) : (
                  <StatusBadge status={o.fulfillmentStatus} />
                )}
                {o.paymentStatus !== "paid" && !isAbandoned(o) && (
                  <PayBadge status={o.paymentStatus} />
                )}
                {isAbandoned(o) && <WaButton order={o} />}
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-[1.75rem] bg-neutral-100 p-2 md:block">
        <table className="min-w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="w-8 py-3 pl-4">
                  <input
                    type="checkbox"
                    className={checkCls}
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
                <th key={i} className={thCls}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr
                key={o._id}
                onClick={() => onOpen(o._id)}
                style={{
                  animationDelay: `${(i % 10) * 35}ms`,
                  animationFillMode: "both",
                }}
                className={`group cursor-pointer border-t border-neutral-200 transition-colors duration-500 animate-in fade-in slide-in-from-bottom-2 hover:bg-white ${
                  selected.has(o._id) ? "bg-blue-600/10" : ""
                }`}
              >
                {selectable && (
                  <td
                    className="w-8 py-3 pl-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={checkCls}
                      checked={selected.has(o._id)}
                      onChange={() => onToggle(o._id)}
                      aria-label={`Select ${o.orderId}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Thumb url={first(o)?.imageUrl} alt={first(o)?.productName} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-extrabold tracking-tight">
                  {o.orderId}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-sm font-extrabold tracking-tight">
                  {o.customerName}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-lg font-extrabold tracking-tight">
                  ₹{o.totalAmount}
                </td>
                <td className="px-4 py-3">
                  <MethodTag method={o.shippingMethod} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Addons order={o} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PayBadge status={o.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.fulfillmentStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-neutral-500">
                  {fmtDate(o.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isAbandoned(o) && <WaButton order={o} />}
                    <button
                      onClick={(e) => del(e, o._id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition-all duration-300 hover:bg-red-100 active:scale-95"
                      title="Delete order"
                      aria-label="Delete order"
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

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="font-extrabold tracking-tight">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 p-3 backdrop-blur-md duration-300 animate-in fade-in md:p-4">
      <div
        className={`${display.className} max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] bg-white text-neutral-950 duration-300 animate-in zoom-in-95 slide-in-from-bottom-4`}
      >
        <div className="p-5 md:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-4xl font-extrabold leading-[0.92] tracking-[-0.045em]">
                Order
                <br />
                <span className="break-all">{order.orderId}.</span>
              </h3>
              <p className="mt-2 text-xs font-semibold text-neutral-500">
                {fmtDateTime(order.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Btn
                onClick={() => setConfirm(true)}
                icon
                variant="danger"
                title="Delete order"
              >
                <Trash2 className="h-4 w-4" />
              </Btn>
              <Btn onClick={onClose} icon title="Close">
                <X className="h-4 w-4" />
              </Btn>
            </div>
          </div>

          {confirm && (
            <div className="mb-5 rounded-3xl bg-red-50 p-4 text-sm duration-300 animate-in fade-in slide-in-from-top-1">
              <p className="mb-3 font-extrabold tracking-tight text-red-600">
                Delete order {order.orderId}? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Btn
                  onClick={() => setConfirm(false)}
                  disabled={!!busy}
                  className="!bg-white"
                >
                  Cancel
                </Btn>
                <Btn
                  onClick={() =>
                    run("delete", () => sanityClient.delete(order._id))
                  }
                  disabled={!!busy}
                  variant="primary"
                  className="!bg-red-600 hover:!bg-red-700"
                >
                  {busy === "delete" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    "Delete"
                  )}
                </Btn>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mb-5 space-y-3">
            {order.items?.map((it, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="group/img relative">
                  <Thumb
                    url={it.imageUrl}
                    alt={it.productName}
                    size="h-14 w-14"
                  />
                  {it.imageUrl && (
                    <button
                      onClick={() => copyImage(it.imageUrl!, i)}
                      title="Copy image"
                      aria-label="Copy image"
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-white opacity-0 transition-all focus-visible:opacity-100 group-hover/img:opacity-100 active:scale-90"
                    >
                      {copied === i ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        <ImageIcon className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="font-extrabold leading-tight tracking-tight">
                    {it.productName}
                    <span className="block text-xs font-semibold text-neutral-500">
                      Size {it.size}
                      {it.isFreeItem && (
                        <span className="ml-2 text-green-700">Free</span>
                      )}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-extrabold tracking-tight">
                    ₹{it.isFreeItem ? 0 : it.price}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
              <span className="text-sm font-semibold text-neutral-500">
                Total
              </span>
              <span className="text-4xl font-extrabold leading-none tracking-[-0.045em]">
                ₹{order.totalAmount}
              </span>
            </div>
          </div>

          {/* Customer */}
          <div className="relative mb-5 space-y-1 rounded-3xl bg-neutral-100 p-4 text-sm">
            <Btn
              onClick={copyAddress}
              className="absolute right-3 top-3 !h-8 !bg-white !px-3 text-xs hover:!bg-neutral-200"
            >
              {copied === "addr" ? (
                <>
                  <Check className="h-3 w-3" strokeWidth={3} /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </Btn>
            <p className="pr-24 text-lg font-extrabold tracking-tight">
              {order.customerName}
            </p>
            <p className="font-medium text-neutral-500">
              {[order.contact1, order.contact2].filter(Boolean).join(", ")}
            </p>
            <p className="font-medium text-neutral-500">
              {[order.address, order.landmark, order.district]
                .filter(Boolean)
                .join(", ")}
              , {order.state} - {order.pincode}
            </p>
            {order.instagramId && (
              <p className="font-medium text-neutral-500">
                @{order.instagramId}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <PayBadge status={order.paymentStatus} />
              <MethodTag method={order.shippingMethod} />
              <Addons order={order} />
              {order.razorpayPaymentId && (
                <span className="truncate text-xs font-medium text-neutral-400">
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
          <div className="mb-5 space-y-3 rounded-3xl bg-neutral-100 p-4 text-sm">
            {row("Method", methodLabel)}
            {order.pairCount
              ? row(
                  "Offer",
                  `${order.pairCount} ${order.pairCount === 1 ? "pair" : "pairs"}`,
                )
              : null}
            {order.advancePaid != null && row("Paid now", `₹${order.advancePaid}`)}
            {order.remainingAmount
              ? row("Collect on delivery", `₹${order.remainingAmount}`)
              : null}
            {order.utr && row("UTR", <span className="font-mono">{order.utr}</span>)}
            {order.paymentScreenshotUrl && (
              <a
                href={order.paymentScreenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${order.paymentScreenshotUrl}?w=600&auto=format`}
                  alt="Payment screenshot"
                  className="max-h-64 w-full rounded-2xl bg-white object-contain"
                />
              </a>
            )}

            <div>
              <label className={labelCls}>Payment status</label>
              <select {...field("paymentStatus")} className={inputLg}>
                {PAY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PAY_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            {order.paymentStatus === "verifying" && (
              <>
                <div className="flex gap-2">
                  <Btn
                    variant="primary"
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
                  </Btn>
                  <Btn
                    variant="danger"
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
                  </Btn>
                </div>
                <p className="text-xs font-medium text-neutral-500">
                  Approve or Reject fills the form. Press Save changes to apply
                  it.
                </p>
              </>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelCls}>Fulfillment status</label>
              <select {...field("fulfillmentStatus")} className={inputLg}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {cap(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Courier</label>
                <input
                  type="text"
                  placeholder="e.g. Delhivery"
                  className={inputLg}
                  {...field("courierName")}
                />
              </div>
              <div>
                <label className={labelCls}>Tracking number</label>
                <input
                  type="text"
                  placeholder="AWB / tracking ID"
                  className={inputLg}
                  {...field("trackingNumber")}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Tracking URL</label>
              <input
                type="url"
                placeholder="https://..."
                className={inputLg}
                {...field("trackingUrl")}
              />
              {form.trackingUrl && (
                <a
                  href={form.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-blue-700"
                >
                  Open tracking link <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div>
              <label className={labelCls}>Admin notes</label>
              <textarea
                rows={2}
                placeholder="Internal notes about this order..."
                className={inputCls}
                {...field("adminNotes")}
              />
            </div>
          </div>

          <div className="sticky bottom-0 mt-6 flex flex-col-reverse justify-end gap-2 border-t border-neutral-200 bg-white pt-5 sm:flex-row">
            <Btn onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Btn>
            <Btn
              onClick={save}
              variant="primary"
              disabled={!!busy}
              className="w-full sm:w-auto"
            >
              {busy === "save" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Btn>
          </div>
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
        if ("Notification" in window && Notification.permission === "granted") {
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
      <div
        className={`${display.className} flex h-64 items-center justify-center`}
      >
        <div className="h-1 w-40 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
        </div>
      </div>
    );
  }

  const alertsOn = notifPerm === "granted" && sound;
  const hasActiveFilters =
    !!search ||
    datePreset !== "all" ||
    methodFilter !== "all" ||
    (tab === "orders" && (statusFilter !== "all" || paymentFilter !== "all"));
  const bulkOn = tab === "orders" && selectedIds.size > 0;

  return (
    <div
      className={`${display.className} min-h-screen bg-white px-4 py-6 text-neutral-950 md:px-8 ${
        bulkOn ? "pb-28" : ""
      }`}
    >
      {banner && (
        <div className="fixed right-4 top-4 z-[60] max-w-xs rounded-3xl bg-neutral-950 p-4 text-white duration-500 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold tracking-tight">
                New order received
              </p>
              <p className="truncate text-xs font-medium text-white/60">
                {banner.customerName} • ₹{banner.totalAmount}
              </p>
              <button
                onClick={() => {
                  setOpen({ id: banner._id });
                  setBanner(null);
                }}
                className="mt-1 text-xs font-extrabold text-blue-400"
              >
                View order
              </button>
            </div>
            <button onClick={() => setBanner(null)} aria-label="Dismiss">
              <X className="h-4 w-4 text-white/60 hover:text-white" />
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

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="duration-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="inline-flex items-center gap-2 rounded-md bg-blue-600/10 px-3.5 py-1.5 text-sm font-semibold text-blue-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
            {paidCount} orders
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <h1 className="text-balance text-5xl font-extrabold leading-[0.9] tracking-[-0.045em] md:text-7xl">
              Orders.
            </h1>
            <Btn onClick={toggleAlerts} variant="primary" className="h-12">
              {alertsOn ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span className="hidden md:inline">
                {notifPerm !== "granted"
                  ? "Enable alerts"
                  : sound
                    ? "Alerts on"
                    : "Sound off"}
              </span>
            </Btn>
          </div>
        </div>

        {/* Tabs, search and filters */}
        <div className="mt-8 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["orders", "Orders", paidCount],
                ["abandoned", "Abandoned carts", abandonedCount],
              ] as const
            ).map(([key, label, n]) => (
              <Chip
                key={key}
                active={tab === key}
                onClick={() => {
                  setTab(key);
                  setPage(1);
                  clearSelection();
                }}
              >
                {label}
                <span className="opacity-60">{n}</span>
              </Chip>
            ))}
            {verifyingCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTab("orders");
                  setPaymentFilter("verifying");
                  setPage(1);
                  clearSelection();
                }}
                className="flex h-9 items-center gap-1.5 rounded-full bg-blue-600/10 px-4 text-xs font-extrabold tracking-tight text-blue-700 transition-all duration-200 hover:bg-blue-600/20 active:scale-90"
              >
                Needs verification
                <span>{verifyingCount}</span>
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by order ID, customer, phone, UTR or tracking ID..."
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              className={`${inputLg} pl-11`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-500">
              {count} of {tab === "abandoned" ? abandonedCount : paidCount}{" "}
              {tab === "abandoned" ? "abandoned carts" : "orders"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={methodFilter}
                onChange={(e) =>
                  reset(setMethodFilter)(e.target.value as MethodFilter)
                }
                className={selectCls}
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
                className={selectCls}
                aria-label="Filter by date"
              >
                {DATE_PRESETS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              {datePreset === "custom" && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
                    From
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => reset(setDateFrom)(e.target.value)}
                      className={selectCls}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
                    To
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => reset(setDateTo)(e.target.value)}
                      className={selectCls}
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
                    className={selectCls}
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
                    className={selectCls}
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
                className={selectCls}
                aria-label="Rows per page"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="mt-6">
          <OrderList
            orders={rows}
            onOpen={(id, confirm) => setOpen({ id, confirm })}
            selectable={tab === "orders"}
            selected={selectedIds}
            onToggle={toggleOne}
            onTogglePage={togglePage}
          />

          {rows.length === 0 && (
            <div className="py-16 text-center duration-500 animate-in fade-in">
              <p className="text-3xl font-extrabold tracking-[-0.04em]">
                {tab === "abandoned"
                  ? "No abandoned carts."
                  : "No orders found."}
              </p>
              {hasActiveFilters && (
                <Btn
                  className="mt-4"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setPaymentFilter("all");
                    setMethodFilter("all");
                    setDatePreset("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Clear filters
                </Btn>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
            <p className="text-sm font-semibold text-neutral-500">
              Page {current} of {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <Btn
                onClick={() => goTo(current - 1)}
                disabled={current === 1}
                icon
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Btn>
              {pageNums.map((n) => (
                <Btn
                  key={n}
                  onClick={() => goTo(n)}
                  icon
                  variant={current === n ? "primary" : "soft"}
                >
                  {n}
                </Btn>
              ))}
              <Btn
                onClick={() => goTo(current + 1)}
                disabled={current === totalPages}
                icon
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {bulkOn && (
        <div className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-[1.75rem] bg-neutral-950 p-3 pl-5 text-white duration-300 animate-in fade-in slide-in-from-bottom-4 md:inset-x-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-extrabold tracking-tight">
              {selectedIds.size} selected
            </span>
            {selectedIds.size < allIds.length && (
              <button
                onClick={selectAllMatching}
                className="text-xs font-semibold text-blue-400"
              >
                Select all {allIds.length}
              </button>
            )}
            <button
              onClick={clearSelection}
              className="text-xs font-semibold text-white/60 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as Fulfillment)}
              className="h-10 cursor-pointer rounded-full bg-white/10 px-4 text-xs font-extrabold text-white outline-none focus:ring-2 focus:ring-white [&>option]:text-neutral-950"
              disabled={bulkBusy}
              aria-label="Bulk fulfillment status"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </select>
            <Btn
              onClick={applyBulkStatus}
              disabled={bulkBusy}
              className="!bg-white !text-neutral-950 hover:!bg-blue-600 hover:!text-white"
            >
              {bulkBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Apply"
              )}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}