/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Star, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/sanity";
import { compressImage } from "@/lib/compress";
import { useQuery } from "@/lib/admin-data";
import {
  Btn,
  Modal,
  ModalBody,
  ModalFoot,
  ModalHead,
  inputCls,
  labelCls,
  textareaCls,
} from "@/components/admin/ui";

type ShoeOpt = { _id: string; productName: string };
type Pic = { file: File; url: string };

const rand = () => Math.random().toString(36).slice(2, 10);

export default function ReviewAdd({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  // Loaded only when this modal opens.
  const { data: shoes } = useQuery<ShoeOpt[]>(
    "shoes-min",
    `*[_type == "shoe"] | order(productName asc){ _id, productName }`,
  );
  const [pics, setPics] = useState<Pic[]>([]);
  const [name, setName] = useState("Anonymous");
  const [shoeId, setShoeId] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = (files: FileList | null) =>
    setPics((p) => [
      ...p,
      ...Array.from(files ?? []).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    ]);

  const submit = async () => {
    setBusy(true);
    try {
      // Compress and upload all images in parallel.
      const reviewImages = await Promise.all(
        pics.map(async ({ file }) => {
          const asset = await client.assets.upload("image", await compressImage(file));
          return {
            _type: "image",
            _key: rand(),
            asset: { _type: "reference", _ref: asset._id },
          };
        }),
      );

      await client.create({
        _type: "review",
        customerName: name || "Anonymous",
        rating,
        reviewText: text,
        isVerifiedPurchase: verified,
        isApproved: true,
        createdAt: new Date().toISOString(),
        reviewImages,
        ...(shoeId && { shoe: { _type: "reference", _ref: shoeId } }),
      });

      toast.success("Review added");
      onAdded();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't add review");
      setBusy(false);
    }
  };

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title={<>Add review<br />image.</>} onClose={onClose} />
      <ModalBody>
        <div>
          <label className={labelCls}>Images (required)</label>
          <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200">
            <Upload className="h-8 w-8" />
            <span className="text-sm font-semibold">Click to upload</span>
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

        <details className="group">
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
                      className={`h-8 w-8 ${
                        n <= rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-300"
                      }`}
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
        <Btn variant="primary" onClick={submit} loading={busy} disabled={!pics.length}>
          {busy ? "Uploading…" : "Add review"}
        </Btn>
      </ModalFoot>
    </Modal>
  );
}