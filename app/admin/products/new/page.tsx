"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Video as VideoIcon, X } from "lucide-react";
import { toast } from "sonner";
import { api, listCache } from "@/lib/admin-data";
import { compressImage, compressVideo } from "@/lib/compress";
import { Btn, Chip, Thumb, inputCls, labelCls } from "@/components/admin/ui";
import { LABELS, OFFERS } from "@/components/admin/products/shared";

const MB = 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_VIDEO_MB = 300; // largest raw file we'll try to compress
const TARGET_MB = 3.5; // Vercel body limit is ~4.5MB
const IMAGES_PER_REQUEST = 4;

type Media = { file: File; url: string };
type Step = "" | "images" | "video" | "save";

export default function NewProductPage() {
  const router = useRouter();
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({ orderNumber: "", productName: "", price: "" });
  const [labels, setLabels] = useState<string[]>([]);
  const [offers, setOffers] = useState({ offer1Pair: true, offer2Pair: false, offer3Pair: false });
  const [images, setImages] = useState<Media[]>([]);
  const [vid, setVid] = useState<Media | null>(null);
  const [step, setStep] = useState<Step>("");
  const [compressing, setCompressing] = useState<"image" | "video" | null>(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  const busy = !!step || !!compressing;

  const pickImages = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, MAX_IMAGES - images.length);
    if (!picked.length) return;
    setCompressing("image");
    try {
      const done = await Promise.all(picked.map((x) => compressImage(x)));
      setImages((p) => [...p, ...done.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    } catch {
      toast.error("Couldn't process one or more images");
    } finally {
      setCompressing(null);
    }
  };

  const pickVideo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) return toast.error("Select a video file");
    if (file.size > MAX_VIDEO_MB * MB) return toast.error(`Video must be under ${MAX_VIDEO_MB}MB`);
    setCompressing("video");
    setProgress(0);
    try {
      const c = await compressVideo(file, TARGET_MB, setProgress);
      if (c.size > TARGET_MB * MB) return toast.error(`Couldn't get under ${TARGET_MB}MB. Try a shorter clip.`);
      setVid({ file: c, url: URL.createObjectURL(c) });
    } catch {
      toast.error("Compression failed. Try another file.");
    } finally {
      setCompressing(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const price = parseFloat(f.price);
    if (!f.productName.trim()) return setErr("Product name is required");
    if (!(price > 0)) return setErr("Price must be greater than 0");
    if (!images.length) return setErr("Add at least one image");
    if (!Object.values(offers).some(Boolean)) return setErr("Select at least one offer");

    let id = "";
    try {
      setStep("save");
      ({ _id: id } = await api<{ _id: string }>("/api/products", {
        method: "POST",
        body: {
          productName: f.productName,
          price,
          orderNumber: parseInt(f.orderNumber) || undefined, // blank = add at the end
          productLabel: labels,
          ...offers,
        },
      }));

      setStep("images");
      for (let i = 0; i < images.length; i += IMAGES_PER_REQUEST) {
        const fd = new FormData();
        images.slice(i, i + IMAGES_PER_REQUEST).forEach((m) => fd.append("images", m.file));
        await api(`/api/products/${id}/media`, { method: "PUT", body: fd });
      }
      if (vid) {
        setStep("video");
        const fd = new FormData();
        fd.append("video", vid.file);
        await api(`/api/products/${id}/media`, { method: "PUT", body: fd });
      }

      listCache.clear();
      router.push("/admin");
    } catch (e) {
      if (id) await api(`/api/products/${id}`, { method: "DELETE" }).catch(() => {}); // roll back
      listCache.clear();
      setErr((e as Error).message || "Failed to create product");
      setStep("");
    }
  };

  const label = compressing
    ? "Compressing…"
    : step === "images"
      ? "Uploading images…"
      : step === "video"
        ? "Uploading video…"
        : step === "save"
          ? "Creating…"
          : "Create product";

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 p-4 pb-28">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Btn icon title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Btn>
        </Link>
        <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Add shoe.</h1>
      </div>

      {err && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-600">{err}</p>}

      <div>
        <label className={labelCls}>Product name</label>
        <input
          className={inputCls}
          value={f.productName}
          onChange={(e) => setF({ ...f, productName: e.target.value })}
          placeholder="Name of the product"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Price (₹)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className={inputCls}
            value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })}
            placeholder="999"
          />
        </div>
        <div>
          <label className={labelCls}>Order number</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className={inputCls}
            value={f.orderNumber}
            onChange={(e) => setF({ ...f, orderNumber: e.target.value })}
            placeholder="Blank = last"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Label</label>
        <div className="flex flex-wrap gap-2">
          {LABELS.map(([v, t]: any) => (
            <Chip
              key={v}
              active={labels.includes(v)}
              onClick={() => setLabels((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
            >
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Show in offers</label>
        <div className="flex flex-wrap gap-2">
          {OFFERS.map(([k, t]) => (
            <Chip key={k} active={offers[k]} onClick={() => setOffers((o) => ({ ...o, [k]: !o[k] }))}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      {/* Images */}
      <div>
        <label className={labelCls}>
          Images <span className="font-medium text-neutral-400">(first one is the cover)</span>
        </label>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {images.map((m, i) => (
            <div key={m.url} className="relative">
              <Thumb src={m.url} className="aspect-square h-auto w-full" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              disabled={busy}
              onClick={() => imgRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 transition hover:bg-neutral-200 active:scale-95 disabled:opacity-40"
            >
              {compressing === "image" ? <span className="text-xs font-bold">…</span> : <Upload className="h-5 w-5" />}
            </button>
          )}
        </div>
        <input
          ref={imgRef}
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={(e) => {
            pickImages(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Video */}
      <div>
        <label className={labelCls}>
          Video <span className="font-medium text-neutral-400">(optional)</span>
        </label>
        {compressing === "video" ? (
          <div className="rounded-3xl bg-neutral-100 p-5 text-center">
            <p className="text-sm font-semibold">Compressing… {progress}%</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-medium text-neutral-400">Runs in your browser. Keep this tab open.</p>
          </div>
        ) : vid ? (
          <div className="relative max-w-xs">
            <video src={vid.url} controls muted playsInline preload="metadata" className="w-full rounded-3xl bg-black" />
            <button
              type="button"
              aria-label="Remove video"
              onClick={() => setVid(null)}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="mt-1 text-xs font-medium text-neutral-400">{(vid.file.size / MB).toFixed(1)}MB</p>
          </div>
        ) : (
          <Btn disabled={busy} onClick={() => vidRef.current?.click()}>
            <VideoIcon className="h-4 w-4" /> Upload video
          </Btn>
        )}
        <input
          ref={vidRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            pickVideo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-end gap-2 border-t border-neutral-200 bg-white/90 p-4 backdrop-blur">
        <Link href="/admin">
          <Btn>Cancel</Btn>
        </Link>
        <Btn type="submit" variant="primary" loading={busy} disabled={busy}>
          {label}
        </Btn>
      </div>
    </form>
  );
}