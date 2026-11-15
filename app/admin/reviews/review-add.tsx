/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Star, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compress";
import { api, listCache } from "@/lib/admin-data";
import {
  Btn, Modal, ModalBody, ModalFoot, ModalHead, inputCls, labelCls, textareaCls,
} from "@/components/admin/ui";

type ShoeOpt = { _id: string; productName: string };
type Pic = { file: File; url: string };

const MAX_IMAGES = 8; // keeps the upload under Vercel's ~4.5MB body limit
const SHOES = "/api/reviews/list?shoes=1";

export default function ReviewAdd({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [shoes, setShoes] = useState<ShoeOpt[] | undefined>(listCache.get(SHOES));
  const [pics, setPics] = useState<Pic[]>([]);
  const [name, setName] = useState("Anonymous");
  const [shoeId, setShoeId] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<"compress" | "save" | null>(null);

  // The product list is fetched only if "Optional details" is opened.
  const loadShoes = () => {
    if (shoes) return;
    api<ShoeOpt[]>(SHOES)
      .then((d) => {
        listCache.set(SHOES, d);
        setShoes(d);
      })
      .catch(() => toast.error("Couldn't load products"));
  };

  // Compress on pick so previews and upload are already small.
  const add = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, MAX_IMAGES - pics.length);
    if (!picked.length) return;
    setBusy("compress");
    try {
      const done = await Promise.all(picked.map((f) => compressImage(f)));
      setPics((p) => [...p, ...done.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    } catch {
      toast.error("Couldn't process one or more images");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setBusy("save");
    try {
      const fd = new FormData();
      pics.forEach((p) => fd.append("images", p.file));
      fd.append("name", name);
      fd.append("shoeId", shoeId);
      fd.append("rating", String(rating));
      fd.append("text", text);
      fd.append("verified", String(verified));
      await api("/api/reviews/list", { method: "POST", body: fd });

      toast.success("Review added");
      onAdded();
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't add review");
      setBusy(null);
    }
  };

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title={<>Add review<br />image.</>} onClose={onClose} />
      <ModalBody>
        <div>
          <label className={labelCls}>Images (required, max {MAX_IMAGES})</label>
          {pics.length < MAX_IMAGES && (
            <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200">
              <Upload className="h-8 w-8" />
              <span className="text-sm font-semibold">
                {busy === "compress" ? "Compressing…" : "Click to upload"}
              </span>
              <span className="text-xs">Select several at once</span>
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  add(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}

          {pics.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {pics.map((p, i) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-2xl">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => setPics((a) => a.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 transition-all hover:bg-white active:scale-90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <details className="group" onToggle={(e) => e.currentTarget.open && loadShoes()}>
          <summary className="cursor-pointer text-sm font-semibold text-neutral-500 hover:text-neutral-950">
            Optional details
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <label className={labelCls}>Customer name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Product</label>
              <select className={inputCls} value={shoeId} onChange={(e) => setShoeId(e.target.value)}>
                <option value="">No product</option>
                {shoes?.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.productName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} stars`}
                    onClick={() => setRating(n)}
                    className="transition-transform active:scale-90"
                  >
                    <Star
                      className={`h-8 w-8 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-300"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Review text</label>
              <textarea rows={3} className={textareaCls} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-neutral-950"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />
              Verified purchase
            </label>
          </div>
        </details>
      </ModalBody>
      <ModalFoot>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} loading={busy === "save"} disabled={!pics.length || !!busy}>
          {busy === "save" ? "Uploading…" : "Add review"}
        </Btn>
      </ModalFoot>
    </Modal>
  );
}