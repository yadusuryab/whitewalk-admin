/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/sanity";
import {
  Btn,
  Modal,
  ModalBody,
  ModalFoot,
  ModalHead,
  Thumb,
  inputCls,
  labelCls,
  textareaCls,
} from "@/components/admin/ui";
import {
  Addons,
  COD_ADVANCE,
  MethodTag,
  PAY_LABEL,
  PAY_STATUSES,
  PayBadge,
  STATUSES,
  WaButton,
  cap,
  fmtDateTime,
  isAbandoned,
  type Order,
} from "./shared";

const TEXT_KEYS = ["courierName", "trackingNumber", "trackingUrl", "adminNotes"] as const;

const Line = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-neutral-500">{label}</span>
    <span className="font-extrabold tracking-tight">{value}</span>
  </div>
);

export default function OrderModal({
  order,
  onClose,
  onSaved,
  onDelete,
}: {
  order: Order;
  onClose: () => void;
  onSaved: (patch: Partial<Order>) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState({
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    courierName: order.courierName ?? "",
    trackingNumber: order.trackingNumber ?? "",
    trackingUrl: order.trackingUrl ?? "",
    adminNotes: order.adminNotes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"addr" | number | null>(null);

  const bind = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: any) => setF({ ...f, [k]: e.target.value }),
  });

  const flash = (k: "addr" | number) => {
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };

  const save = async () => {
    setBusy(true);
    try {
      // .set() ignores undefined, so cleared fields are .unset()
      const set: Record<string, unknown> = {
        fulfillmentStatus: f.fulfillmentStatus,
        paymentStatus: f.paymentStatus,
      };
      const unset: string[] = [];
      for (const k of TEXT_KEYS) {
        const v = f[k].trim();
        if (v) set[k] = v;
        else unset.push(k);
      }
      let p = client.patch(order._id).set(set);
      if (unset.length) p = p.unset(unset);
      await p.commit();
      onSaved({
        ...set,
        ...Object.fromEntries(unset.map((k) => [k, undefined])),
      } as Partial<Order>);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save order");
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    const sizes = order.items.map((it, i) => `SIZE PAIR ${i + 1}= ${it.size}`).join("\n");
    const collect = order.remainingAmount ?? Math.max(0, order.totalAmount - COD_ADVANCE);
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
      toast.error("Couldn't copy");
    }
  };

  const copyImage = async (url: string, i: number) => {
    try {
      // ClipboardItem needs PNG.
      const blob = await (await fetch(url.replace(/auto=format/g, "fm=png"))).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      flash(i);
    } catch {
      toast.error("Couldn't copy image");
    }
  };

  const method =
    order.paymentMethod === "manual_upi"
      ? "Manual UPI"
      : order.paymentMethod === "razorpay"
        ? "Razorpay"
        : "—";

  return (
    <Modal wide onClose={onClose}>
      <ModalHead
        title={
          <>
            Order
            <br />
            <span className="break-all">{order.orderId}.</span>
          </>
        }
        onClose={onClose}
      />
      <ModalBody>
        <p className="-mt-2 text-xs font-semibold text-neutral-500">
          {fmtDateTime(order.createdAt)}
        </p>

        {/* Items */}
        <div className="space-y-3">
          {order.items?.map((it, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="group/img relative">
                <Thumb src={it.imageUrl} className="h-14 w-14" />
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
                    {it.isFreeItem && <span className="ml-2 text-green-700">Free</span>}
                  </span>
                </span>
                <span className="whitespace-nowrap font-extrabold tracking-tight">
                  ₹{it.isFreeItem ? 0 : it.price}
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
            <span className="text-sm font-semibold text-neutral-500">Total</span>
            <span className="text-4xl font-extrabold leading-none tracking-[-0.045em]">
              ₹{order.totalAmount}
            </span>
          </div>
        </div>

        {/* Customer */}
        <div className="relative space-y-1 rounded-3xl bg-neutral-100 p-4 text-sm">
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
          <p className="pr-24 text-lg font-extrabold tracking-tight">{order.customerName}</p>
          <p className="font-medium text-neutral-500">
            {[order.contact1, order.contact2].filter(Boolean).join(", ")}
          </p>
          <p className="font-medium text-neutral-500">
            {[order.address, order.landmark, order.district].filter(Boolean).join(", ")},{" "}
            {order.state} - {order.pincode}
          </p>
          {order.instagramId && (
            <p className="font-medium text-neutral-500">@{order.instagramId}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <PayBadge status={order.paymentStatus} />
            <MethodTag method={order.shippingMethod} />
            <Addons order={order} />
            {isAbandoned(order) && <WaButton order={order} />}
          </div>
        </div>

        {/* Payment */}
        <div className="space-y-3 rounded-3xl bg-neutral-100 p-4 text-sm">
          <Line label="Method" value={method} />
          {order.pairCount ? (
            <Line
              label="Offer"
              value={`${order.pairCount} ${order.pairCount === 1 ? "pair" : "pairs"}`}
            />
          ) : null}
          {order.advancePaid != null && (
            <Line label="Paid now" value={`₹${order.advancePaid}`} />
          )}
          {order.remainingAmount ? (
            <Line label="Collect on delivery" value={`₹${order.remainingAmount}`} />
          ) : null}
          {order.utr && <Line label="UTR" value={<span className="font-mono">{order.utr}</span>} />}
          {order.razorpayPaymentId && (
            <Line
              label="Razorpay"
              value={<span className="font-mono text-xs">{order.razorpayPaymentId}</span>}
            />
          )}
          {order.paymentScreenshotUrl && (
            <a href={order.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${order.paymentScreenshotUrl}?w=600&auto=format`}
                alt="Payment screenshot"
                loading="lazy"
                className="max-h-64 w-full rounded-2xl bg-white object-contain"
              />
            </a>
          )}

          <div>
            <label className={labelCls}>Payment status</label>
            <select {...bind("paymentStatus")} className={inputCls}>
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
                    setF({ ...f, paymentStatus: "paid", fulfillmentStatus: "processing" })
                  }
                >
                  Approve
                </Btn>
                <Btn
                  variant="danger"
                  className="flex-1"
                  onClick={() =>
                    setF({ ...f, paymentStatus: "rejected", fulfillmentStatus: "cancelled" })
                  }
                >
                  Reject
                </Btn>
              </div>
              <p className="text-xs font-medium text-neutral-500">
                Approve or Reject fills the form. Press Save changes to apply.
              </p>
            </>
          )}
        </div>

        {/* Fulfillment */}
        <div>
          <label className={labelCls}>Fulfillment status</label>
          <select {...bind("fulfillmentStatus")} className={inputCls}>
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
            <input placeholder="e.g. Delhivery" className={inputCls} {...bind("courierName")} />
          </div>
          <div>
            <label className={labelCls}>Tracking number</label>
            <input placeholder="AWB / tracking ID" className={inputCls} {...bind("trackingNumber")} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Tracking URL</label>
          <input type="url" placeholder="https://..." className={inputCls} {...bind("trackingUrl")} />
          {f.trackingUrl && (
            <a
              href={f.trackingUrl}
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
            placeholder="Internal notes…"
            className={textareaCls}
            {...bind("adminNotes")}
          />
        </div>
      </ModalBody>
      <ModalFoot>
        <Btn variant="danger" icon title="Delete order" onClick={onDelete} className="mr-auto">
          <Trash2 className="h-4 w-4" />
        </Btn>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={save} loading={busy}>
          Save changes
        </Btn>
      </ModalFoot>
    </Modal>
  );
}