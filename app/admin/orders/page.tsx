/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/orders/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  WaPrepaidButton,
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

/* ---------- server calls (cookie auth, no Sanity token in browser) ---------- */

const POLL_MS = 30_000;

const call = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("Request failed");
  return r.json();
};

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

/* ---------- delete confirmation ---------- */

function ConfirmDelete({
  order,
  onCancel,
  onConfirm,
}: {
  order: Order;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 duration-150 animate-in fade-in sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="del-title"
        aria-describedby="del-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:zoom-in-95"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 id="del-title" className="mt-4 text-xl font-extrabold tracking-tight">
          Delete this order?
        </h2>
        <p id="del-desc" className="mt-1 text-sm font-medium text-neutral-500">
          <span className="font-extrabold text-neutral-950">{order.orderId}</span> ·{" "}
          {order.customerName} · ₹{order.totalAmount} will be removed permanently.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="h-12 flex-1 rounded-full bg-neutral-100 text-sm font-extrabold tracking-tight text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 flex-1 rounded-full bg-red-600 text-sm font-extrabold tracking-tight text-white transition-all hover:bg-red-700 active:scale-95"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
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
  const [toDelete, setToDelete] = useState<Order | null>(null);
  const q = useDebounced(search).trim().toLowerCase();

  /* ----- server search across all orders ----- */

  const [found, setFound] = useState<Order[]>([]);

  useEffect(() => {
    if (q.length < 3) {
      setFound([]);
      return;
    }
    const ac = new AbortController();
    call(`/api/orders/search?q=${encodeURIComponent(q)}`, { signal: ac.signal })
      .then(setFound)
      .catch(() => {});
    return () => ac.abort();
  }, [q]);

  // recent orders + search hits, deduped
  const all = useMemo(() => {
    const m = new Map(orders.map((o) => [o._id, o]));
    found.forEach((o) => m.has(o._id) || m.set(o._id, o));
    return [...m.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, found]);

  /* ----- alerts + light polling ----- */

  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  soundRef.current = soundOn;
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    setPerm("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  // Alerts: diff each fresh list against the ids already seen.
  useEffect(() => {
    if (!data) return;
    if (!known.current) {
      known.current = new Set(data.map((o) => o._id)); // first load: no alerts
      return;
    }
    const fresh = data.filter((o) => !known.current!.has(o._id));
    fresh.forEach((o) => {
      known.current!.add(o._id);
      toast(`New order · ₹${o.totalAmount}`, {
        description: o.customerName,
        duration: 8000,
        action: { label: "View", onClick: () => setOpenId(o._id) },
      });
      if (soundRef.current) new Audio("/notification.mp3").play().catch(() => {});
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("New order received", {
          body: `${o.customerName} • ₹${o.totalAmount}`,
          tag: o._id,
        });
      }
    });
  }, [data]);

  // Polls a few-byte signature. Full list is refetched only when it changes.
  useEffect(() => {
    let sig: string | null = null;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const s = await call("/api/orders/poll");
        const next = `${s.count}|${s.latest}`;
        if (sig !== null && next !== sig) refetch();
        sig = next;
      } catch {}
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
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
    return all.filter((o) => {
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
  }, [all, tab, q, status, pay, method, preset, from, to]);

  const { rows, page, pages, setPage } = usePaged(
    filtered,
    perPage,
    `${tab}|${q}|${status}|${pay}|${method}|${preset}|${from}|${to}|${perPage}`,
  );

  const open = all.find((o) => o._id === openId);
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
      () => {
        mutate((d) => d.filter((x) => x._id !== o._id));
        setFound((d) => d.filter((x) => x._id !== o._id));
      },
      () => {
        mutate((d) =>
          [...d, o].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      },
      () => call(`/api/orders/${o._id}`, { method: "DELETE" }),
    );
  };

  const confirmRemove = () => {
    if (!toDelete) return;
    const o = toDelete;
    setToDelete(null);
    remove(o);
  };

  const setMany = (ids: string[], to: (id: string) => Fulfillment) =>
    call("/api/orders/bulk", {
      method: "POST",
      body: JSON.stringify({
        updates: ids.map((id) => ({ id, fulfillmentStatus: to(id) })),
      }),
    });

  // Optimistic bulk update with Undo. No confirm dialog.
  const applyBulk = async () => {
    const ids = [...picked];
    const prev = new Map(all.map((o) => [o._id, o.fulfillmentStatus]));
    const paint = (to: (id: string) => Fulfillment) => {
      const apply = (d: Order[]) =>
        d.map((o) => (ids.includes(o._id) ? { ...o, fulfillmentStatus: to(o._id) } : o));
      mutate(apply);
      setFound(apply);
    };
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

      <div className="mt-5 flex flex-col gap-3 sm:mt-8">
        {/* Chips scroll sideways on phones instead of wrapping into 3 rows */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:whitespace-nowrap">
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
          placeholder="Order ID, name, phone, UTR, tracking…"
        />

        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <p className="text-sm font-semibold text-neutral-500">
            {filtered.length} of {tab === "abandoned" ? abandonedCount : paidCount}
          </p>
          {/* 2-column grid on phones, free-flowing row from sm up */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>*]:min-w-0 [&_select]:w-full sm:[&_select]:w-auto">
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
                  className={`${selectCls} w-full sm:w-auto`}
                />
                <input
                  type="date"
                  aria-label="To"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className={`${selectCls} w-full sm:w-auto`}
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

      <div className="mt-4 space-y-2 sm:mt-6">
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
            {/* Phone: info on top, badges/actions underneath. sm+: single line. */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {tab === "orders" && (
                  <input
                    type="checkbox"
                    className={`${checkCls} shrink-0`}
                    aria-label={`Select ${o.orderId}`}
                    checked={picked.has(o._id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleOne(o._id)}
                  />
                )}
                <div className="shrink-0">
                  <Thumb src={o.items?.[0]?.imageUrl} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 sm:text-[11px]">
                    {o.orderId} · {fmtDate(o.createdAt)}
                  </p>
                  <p className="truncate font-extrabold tracking-tight">{o.customerName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <MethodTag method={o.shippingMethod} />
                    <Addons order={o} />
                  </div>
                </div>
                <p className="shrink-0 text-lg font-extrabold tracking-tight sm:text-xl">
                  ₹{o.totalAmount}
                </p>
              </div>
              <div className="w-full sm:w-auto sm:shrink-0">
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
                      {o.shippingMethod === "cod" &&
                        o.paymentStatus !== "paid" &&
                        ["pending", "processing"].includes(o.fulfillmentStatus) && (
                          <WaPrepaidButton order={o} />
                        )}
                    </>
                  )}
                  <Btn
                    icon
                    variant="danger"
                    title="Delete order"
                    onClick={() => setToDelete(o)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Btn>
                </Actions>
              </div>
            </div>
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

      {/* Keeps the last rows and pager clear of the floating bulk bar */}
      {bulkOn && <div aria-hidden className="h-32 sm:h-24" />}

      {open && (
        <OrderModal
          key={open._id}
          order={open}
          onClose={() => setOpenId(null)}
          onSaved={(p) => {
            mutate((d) => d.map((o) => (o._id === open._id ? { ...o, ...p } : o)));
            setFound((d) => d.map((o) => (o._id === open._id ? { ...o, ...p } : o)));
          }}
          onDelete={() => setToDelete(open)}
        />
      )}

      {toDelete && (
        <ConfirmDelete
          order={toDelete}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmRemove}
        />
      )}

      {bulkOn && (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-3xl flex-col gap-3 rounded-3xl bg-neutral-950 p-3 text-white shadow-2xl duration-200 animate-in fade-in slide-in-from-bottom-4 sm:bottom-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-[1.75rem] sm:p-3 sm:pl-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs font-semibold sm:px-0">
            <span className="text-sm font-extrabold tracking-tight">
              {picked.size} selected
            </span>
            {picked.size < filtered.length && (
              <button
                onClick={() => setPicked(new Set(filtered.map((o) => o._id)))}
                className="py-1 text-blue-400"
              >
                Select all {filtered.length}
              </button>
            )}
            <button
              onClick={() => setPicked(new Set())}
              className="py-1 text-white/60 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bulk}
              onChange={(e) => setBulk(e.target.value as Fulfillment)}
              aria-label="Bulk fulfillment status"
              className="h-10 min-w-0 flex-1 cursor-pointer rounded-full bg-white/10 px-4 text-xs font-extrabold text-white outline-none focus:ring-2 focus:ring-white sm:flex-none [&>option]:text-neutral-950"
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
              className="shrink-0 !bg-white !text-neutral-950 hover:!bg-blue-600 hover:!text-white"
            >
              Apply
            </Btn>
          </div>
        </div>
      )}
    </>
  );
}