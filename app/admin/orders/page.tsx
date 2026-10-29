/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/orders/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/sanity";
import { undoable, useDebounced, usePaged, useQuery } from "@/lib/admin-data";
import {
  Actions,
  Btn,
  Chip,
  Empty,
  PER_PAGE,
  PageHead,
  Pager,
  Row,
  SearchInput,
  Select,
  Skeleton,
  Thumb,
  checkCls,
  selectCls,
} from "@/components/admin/ui";
import {
  Addons,
  MethodTag,
  PAY_LABEL,
  PAY_STATUSES,
  PayBadge,
  QUERY,
  STATUSES,
  StatusBadge,
  WaButton,
  cap,
  fmtDate,
  isAbandoned,
  looksLikePhone,
  normPhone,
  type Fulfillment,
  type MethodFilter,
  type Order,
  type PaymentStatus,
} from "./shared";

// Modal code loads only when an order is opened.
const OrderModal = dynamic(() => import("./order-modal"), { ssr: false });

/* ---------- filters ---------- */

type Tab = "orders" | "abandoned";
type DatePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

const DATES: [DatePreset, string][] = [
  ["all", "Any date"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["month", "This month"],
  ["custom", "Pick dates…"],
];
const METHODS: [MethodFilter, string][] = [
  ["all", "COD & Prepaid"],
  ["cod", "COD only"],
  ["online", "Prepaid only"],
];
const PAY_OPTS: ["all" | PaymentStatus, string][] = [
  ["all", "All payments"],
  ...PAY_STATUSES.filter((s) => s !== "pending" && s !== "failed").map(
    (s) => [s, PAY_LABEL[s]] as [PaymentStatus, string],
  ),
];
const STATUS_OPTS: ["all" | Fulfillment, string][] = [
  ["all", "All statuses"],
  ...STATUSES.map((s) => [s, cap(s)] as [Fulfillment, string]),
];

const DAY = 864e5;
function range(p: DatePreset, from: string, to: string): [number | null, number | null] {
  const d = new Date();
  const t0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  switch (p) {
    case "today":
      return [t0, t0 + DAY - 1];
    case "yesterday":
      return [t0 - DAY, t0 - 1];
    case "7d":
      return [t0 - 6 * DAY, null];
    case "30d":
      return [t0 - 29 * DAY, null];
    case "month":
      return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), null];
    case "custom":
      return [
        from ? +new Date(`${from}T00:00:00`) : null,
        to ? +new Date(`${to}T23:59:59.999`) : null,
      ];
    default:
      return [null, null];
  }
}

/* ---------- page ---------- */

export default function OrdersPage() {
  const { data, error, refetch, mutate } = useQuery<Order[]>("orders", QUERY);
  const orders = useMemo(() => data ?? [], [data]);

  const [tab, setTab] = useState<Tab>("orders");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Fulfillment>("all");
  const [pay, setPay] = useState<"all" | PaymentStatus>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [preset, setPreset] = useState<DatePreset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<Fulfillment>("processing");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(search).trim().toLowerCase();

  /* ----- alerts + realtime ----- */

  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  soundRef.current = soundOn;
  const known = useRef(new Set<string>());

  useEffect(() => {
    setPerm("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  useEffect(() => {
    known.current = new Set(orders.map((o) => o._id));
  }, [orders]);

  // Any change refetches, debounced so bursts collapse into one request.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const sub = client
      .listen(`*[_type == "order"]`, {}, { includeResult: true })
      .subscribe((u: any) => {
        clearTimeout(t);
        t = setTimeout(refetch, 300);

        const o = u.result as Order | undefined;
        if (u.transition !== "appear" || !o || known.current.has(o._id)) return;
        known.current.add(o._id);

        toast(`New order · ₹${o.totalAmount}`, {
          description: o.customerName,
          duration: 8000,
          action: { label: "View", onClick: () => setOpenId(o._id) },
        });
        // Audio is created on demand, so nothing is downloaded up front.
        if (soundRef.current) new Audio("/notification.mp3").play().catch(() => {});
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("New order received", {
            body: `${o.customerName} • ₹${o.totalAmount}`,
            tag: o._id,
          });
        }
      });
    return () => {
      clearTimeout(t);
      sub.unsubscribe();
    };
  }, [refetch]);

  const toggleAlerts = async () => {
    if (perm === "granted") return setSoundOn((s) => !s);
    if ("Notification" in window) setPerm(await Notification.requestPermission());
  };

  /* ----- derived ----- */

  const abandonedCount = useMemo(() => orders.filter(isAbandoned).length, [orders]);
  const paidCount = orders.length - abandonedCount;
  const verifying = useMemo(
    () => orders.filter((o) => o.paymentStatus === "verifying").length,
    [orders],
  );

  const filtered = useMemo(() => {
    const phone = q && looksLikePhone(q) ? normPhone(q) : "";
    const [lo, hi] = range(preset, from, to);
    return orders.filter((o) => {
      if (
        tab === "abandoned"
          ? !isAbandoned(o)
          : isAbandoned(o) ||
            (status !== "all" && o.fulfillmentStatus !== status) ||
            (pay !== "all" && o.paymentStatus !== pay)
      )
        return false;
      if (method !== "all" && o.shippingMethod !== method) return false;
      const t = +new Date(o.createdAt);
      if ((lo !== null && t < lo) || (hi !== null && t > hi)) return false;
      if (!q) return true;
      return (
        [o.orderId, o.customerName, o.utr, o.razorpayPaymentId, o.trackingNumber].some(
          (v) => v?.toLowerCase().includes(q),
        ) ||
        [o.contact1, o.contact2].some(
          (v) => v?.includes(q) || (!!phone && normPhone(v).includes(phone)),
        )
      );
    });
  }, [orders, tab, q, status, pay, method, preset, from, to]);

  const { rows, page, pages, setPage } = usePaged(
    filtered,
    perPage,
    `${tab}|${q}|${status}|${pay}|${method}|${preset}|${from}|${to}|${perPage}`,
  );

  const open = orders.find((o) => o._id === openId);
  const filtering =
    !!search ||
    preset !== "all" ||
    method !== "all" ||
    (tab === "orders" && (status !== "all" || pay !== "all"));
  const bulkOn = tab === "orders" && picked.size > 0;
  const allOnPage = rows.length > 0 && rows.every((o) => picked.has(o._id));

  /* ----- actions ----- */

  const toggleOne = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const togglePage = () =>
    setPicked((p) => {
      const n = new Set(p);
      rows.forEach((o) => (allOnPage ? n.delete(o._id) : n.add(o._id)));
      return n;
    });

  const remove = (o: Order) => {
    setOpenId(null);
    setPicked((p) => {
      const n = new Set(p);
      n.delete(o._id);
      return n;
    });
    undoable(
      o._id,
      `Deleted ${o.orderId}`,
      () => mutate((d) => d.filter((x) => x._id !== o._id)),
      () =>
        mutate((d) =>
          [...d, o].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
      () => client.delete(o._id),
    );
  };

  const setMany = async (ids: string[], to: (id: string) => Fulfillment) => {
    const tx = client.transaction();
    ids.forEach((id) => tx.patch(id, (p) => p.set({ fulfillmentStatus: to(id) })));
    await tx.commit();
  };

  // Optimistic bulk update with Undo. No confirm dialog.
  const applyBulk = async () => {
    const ids = [...picked];
    const prev = new Map(orders.map((o) => [o._id, o.fulfillmentStatus]));
    const paint = (to: (id: string) => Fulfillment) =>
      mutate((d) =>
        d.map((o) => (ids.includes(o._id) ? { ...o, fulfillmentStatus: to(o._id) } : o)),
      );
    const restore = (id: string) => prev.get(id)!;

    paint(() => bulk);
    setPicked(new Set());
    setBulkBusy(true);
    try {
      await setMany(ids, () => bulk);
      toast.success(`${ids.length} marked ${cap(bulk)}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            paint(restore);
            await setMany(ids, restore).catch(() => toast.error("Undo failed"));
          },
        },
      });
    } catch {
      paint(restore);
      toast.error("Couldn't update orders");
    } finally {
      setBulkBusy(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPay("all");
    setMethod("all");
    setPreset("all");
    setFrom("");
    setTo("");
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setPicked(new Set());
  };

  const alertsOn = perm === "granted" && soundOn;

  return (
    <>
      <PageHead count={data && `${paidCount} orders`} title="Orders.">
        <Btn variant="primary" className="h-12" onClick={toggleAlerts}>
          {alertsOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          <span className="hidden md:inline">
            {perm !== "granted" ? "Enable alerts" : soundOn ? "Alerts on" : "Sound off"}
          </span>
        </Btn>
      </PageHead>

      <div className="mt-8 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={tab === "orders"} onClick={() => switchTab("orders")}>
            Orders <span className="opacity-60">{paidCount}</span>
          </Chip>
          <Chip active={tab === "abandoned"} onClick={() => switchTab("abandoned")}>
            Abandoned carts <span className="opacity-60">{abandonedCount}</span>
          </Chip>
          {verifying > 0 && (
            <button
              type="button"
              onClick={() => {
                switchTab("orders");
                setPay("verifying");
              }}
              className="flex h-9 items-center gap-1.5 rounded-full bg-blue-600/10 px-4 text-xs font-extrabold tracking-tight text-blue-700 transition-all hover:bg-blue-600/20 active:scale-90"
            >
              Needs verification {verifying}
            </button>
          )}
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Order ID, customer, phone, UTR or tracking ID…  ( / )"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-500">
            {filtered.length} of {tab === "abandoned" ? abandonedCount : paidCount}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Method" value={method} onChange={setMethod} options={METHODS} />
            <Select label="Date" value={preset} onChange={setPreset} options={DATES} />
            {preset === "custom" && (
              <>
                <input
                  type="date"
                  aria-label="From"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className={selectCls}
                />
                <input
                  type="date"
                  aria-label="To"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className={selectCls}
                />
              </>
            )}
            {tab === "orders" && (
              <>
                <Select label="Payment" value={pay} onChange={setPay} options={PAY_OPTS} />
                <Select label="Status" value={status} onChange={setStatus} options={STATUS_OPTS} />
              </>
            )}
            <Select label="Per page" value={perPage} onChange={setPerPage} options={PER_PAGE} />
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {!data && !error && <Skeleton />}
        {!data && error && (
          <Empty text="Couldn't load orders." action="Retry" onAction={refetch} />
        )}

        {tab === "orders" && rows.length > 0 && (
          <label className="flex cursor-pointer items-center gap-3 px-3 pb-1 text-xs font-semibold text-neutral-500">
            <input
              type="checkbox"
              className={checkCls}
              checked={allOnPage}
              onChange={togglePage}
            />
            Select page
          </label>
        )}

        {rows.map((o) => (
          <Row key={o._id} active={picked.has(o._id)} onClick={() => setOpenId(o._id)}>
            {tab === "orders" && (
              <input
                type="checkbox"
                className={checkCls}
                aria-label={`Select ${o.orderId}`}
                checked={picked.has(o._id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleOne(o._id)}
              />
            )}
            <Thumb src={o.items?.[0]?.imageUrl} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                {o.orderId} · {fmtDate(o.createdAt)}
              </p>
              <p className="truncate font-extrabold tracking-tight">{o.customerName}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <MethodTag method={o.shippingMethod} />
                <Addons order={o} />
              </div>
            </div>
            <p className="text-xl font-extrabold tracking-tight">₹{o.totalAmount}</p>
            <Actions>
              {isAbandoned(o) ? (
                <>
                  <PayBadge status={o.paymentStatus} />
                  <WaButton order={o} />
                </>
              ) : (
                <>
                  <StatusBadge status={o.fulfillmentStatus} />
                  {o.paymentStatus !== "paid" && <PayBadge status={o.paymentStatus} />}
                </>
              )}
              <Btn icon variant="danger" title="Delete order" onClick={() => remove(o)}>
                <Trash2 className="h-4 w-4" />
              </Btn>
            </Actions>
          </Row>
        ))}

        {data && !rows.length && (
          <Empty
            text={tab === "abandoned" ? "No abandoned carts." : "No orders found."}
            onAction={filtering ? clearFilters : undefined}
          />
        )}
      </div>

      <Pager page={page} pages={pages} onPage={setPage} />

      {open && (
        <OrderModal
          key={open._id}
          order={open}
          onClose={() => setOpenId(null)}
          onSaved={(p) =>
            mutate((d) => d.map((o) => (o._id === open._id ? { ...o, ...p } : o)))
          }
          onDelete={() => remove(open)}
        />
      )}

      {bulkOn && (
        <div className="fixed inset-x-3 bottom-6 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-[1.75rem] bg-neutral-950 p-3 pl-5 text-white shadow-2xl duration-200 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="text-sm font-extrabold tracking-tight">
              {picked.size} selected
            </span>
            {picked.size < filtered.length && (
              <button
                onClick={() => setPicked(new Set(filtered.map((o) => o._id)))}
                className="text-blue-400"
              >
                Select all {filtered.length}
              </button>
            )}
            <button
              onClick={() => setPicked(new Set())}
              className="text-white/60 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bulk}
              onChange={(e) => setBulk(e.target.value as Fulfillment)}
              aria-label="Bulk fulfillment status"
              className="h-10 cursor-pointer rounded-full bg-white/10 px-4 text-xs font-extrabold text-white outline-none focus:ring-2 focus:ring-white [&>option]:text-neutral-950"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </select>
            <Btn
              onClick={applyBulk}
              loading={bulkBusy}
              className="!bg-white !text-neutral-950 hover:!bg-blue-600 hover:!text-white"
            >
              Apply
            </Btn>
          </div>
        </div>
      )}
    </>
  );
}