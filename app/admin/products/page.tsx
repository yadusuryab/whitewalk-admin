"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { api, isPending, undoable, useDebounced, useList } from "@/lib/admin-data";
import {
  BLUE_TAG, Btn, Empty, PER_PAGE, PageHead, Pager, Pill, Row,
  SearchInput, Select, Skeleton, Tag, Thumb,
} from "@/components/admin/ui";
import { LABELS, OFFERS, type Shoe } from "@/components/admin/products/shared";

const ProductEdit = dynamic(() => import("@/components/admin/products/product-edit"), { ssr: false });

type Status = "all" | "active" | "off";
type List = { total: number; items: Shoe[] };

const STATUS: [Status, string][] = [
  ["all", "All status"],
  ["active", "Active only"],
  ["off", "Disabled only"],
];
const LABEL_OPTS: [string, any][] = [["all", "All labels"], ...LABELS];
const LABEL_TITLE: Record<string, string> = Object.fromEntries(LABELS);

const write = (id: string, method: "PUT" | "DELETE", body?: object) =>
  api(`/api/products/${id}`, { method, body });

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [label, setLabel] = useState("all");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [full, setFull] = useState<Shoe | null>(null);
  const q = useDebounced(search).trim().toLowerCase();

  const qs = new URLSearchParams({ page: String(page), per: String(perPage), q, status, label }).toString();
  const { data, error, loading, mutate, refetch } = useList<List>("/api/products", qs);

  const items = (data?.items ?? []).filter((s) => !isPending(s._id));
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const filtering = !!search || status !== "all" || label !== "all";

  // Filter changes go back to page 1.
  const reset = <T,>(set: (v: T) => void) => (v: T) => (set(v), setPage(1));

  // Last item on the last page deleted → step back.
  useEffect(() => {
    if (data && page > pages) setPage(pages);
  }, [data, page, pages]);

  // Full doc (sizes, video…) is fetched only when the editor opens.
  useEffect(() => {
    setFull(null);
    if (!editId) return;
    const ac = new AbortController();
    api<Shoe>(`/api/products?id=${editId}`, { signal: ac.signal })
      .then(setFull)
      .catch((e) => {
        if (e?.name === "AbortError") return;
        toast.error("Couldn't load product");
        setEditId(null);
      });
    return () => ac.abort();
  }, [editId]);

  const patch = (id: string, p: Partial<Shoe>) =>
    mutate((l) => ({ ...l, items: l.items.map((s) => (s._id === id ? { ...s, ...p } : s)) }));

  const toggle = async (s: Shoe) => {
    const next = !s.isDisabled;
    patch(s._id, { isDisabled: next });
    try {
      await write(s._id, "PUT", { isDisabled: next });
    } catch {
      patch(s._id, { isDisabled: !next });
      toast.error("Couldn't update status");
    }
  };

  const remove = (s: Shoe) =>
    undoable(
      s._id,
      `Deleted “${s.productName}”`,
      () => mutate((l) => ({ total: l.total - 1, items: l.items.filter((x) => x._id !== s._id) })),
      () =>
        mutate((l) => ({
          total: l.total + 1,
          items: [...l.items, s].sort((a, b) => a.orderNumber - b.orderNumber),
        })),
      async () => {
        await write(s._id, "DELETE");
        refetch(); // refill the page
      },
    );

  const goto = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <PageHead count={data && `${total} products`} title="Products.">
        <Link href="/admin/products/new">
          <Btn variant="primary" className="h-12">
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline">Add shoe</span>
          </Btn>
        </Link>
      </PageHead>

      <div className="mt-6 flex flex-col gap-3 sm:mt-8">
        <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search name, order number or price…" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-neutral-500">
            {items.length} of {total}
          </p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>select]:shrink-0">
            <Select label="Status" value={status} onChange={reset(setStatus)} options={STATUS} />
            <Select label="Label" value={label} onChange={reset(setLabel)} options={LABEL_OPTS} />
            <Select label="Per page" value={perPage} onChange={reset(setPerPage)} options={PER_PAGE} />
          </div>
        </div>
      </div>

      <div className={`mt-5 space-y-2 transition-opacity sm:mt-6 ${loading && data ? "opacity-50" : ""}`}>
        {!data && !error && <Skeleton />}
        {!data && error && <Empty text="Couldn't load products." action="Retry" onAction={refetch} />}

        {items.map((s) => (
          <Row key={s._id} dim={s.isDisabled} onClick={() => setEditId(s._id)}>
            <Thumb src={s.img} className="h-16 w-16 sm:h-14 sm:w-14" />

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400">#{s.orderNumber}</p>
              <p className="truncate font-extrabold tracking-tight">{s.productName}</p>
              <p className="text-lg font-extrabold leading-tight tracking-tight sm:hidden">₹{s.price}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {s.productLabel?.map((l) => (
                  <Tag key={l}>{LABEL_TITLE[l] ?? l}</Tag>
                ))}
                {OFFERS.filter(([k]) => s[k] ?? k === "offer1Pair").map(([k, t]) => (
                  <Tag key={k} className={BLUE_TAG}>{t}</Tag>
                ))}
                {s.hasVideo && (
                  <Tag className={BLUE_TAG}>
                    <Video className="h-3 w-3" /> Video
                  </Tag>
                )}
                {!!s.disabledSizes?.length && (
                  <span className="text-[11px] font-semibold text-red-500">Off: {s.disabledSizes.join(", ")}</span>
                )}
              </div>
            </div>

            <p className="hidden text-xl font-extrabold tracking-tight sm:block">₹{s.price}</p>

            <div
              className="flex w-full items-center justify-between gap-2 border-t border-neutral-200 pt-3 sm:ml-auto sm:w-auto sm:justify-end sm:border-0 sm:pt-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Pill on={!s.isDisabled} onLabel="Active" offLabel="Disabled" onClick={() => toggle(s)} />
              <div className="flex gap-2">
                <Btn icon title="Edit" onClick={() => setEditId(s._id)}>
                  <Pencil className="h-4 w-4" />
                </Btn>
                <Btn icon variant="danger" title="Delete" onClick={() => remove(s)}>
                  <Trash2 className="h-4 w-4" />
                </Btn>
              </div>
            </div>
          </Row>
        ))}

        {data && !items.length && (
          <Empty
            text="No products found."
            onAction={
              filtering
                ? () => {
                    setSearch("");
                    setStatus("all");
                    setLabel("all");
                    setPage(1);
                  }
                : undefined
            }
          />
        )}
      </div>

      <Pager page={page} pages={pages} onPage={goto} />

      {full && <ProductEdit key={full._id} shoe={full} total={total} onSaved={refetch} onClose={() => setEditId(null)} />}
    </>
  );
}