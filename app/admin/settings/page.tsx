// app/admin/settings/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/sanity";
import { useQuery } from "@/lib/admin-data";
import { Btn, PageHead, Skeleton, inputCls } from "@/components/admin/ui";

const UPI = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
type Settings = { _id: string; upiId?: string } | null;

export default function SettingsPage() {
  const { data, mutate } = useQuery<Settings>(
    "settings",
    `*[_type == "settings"][0]{ _id, upiId }`,
  );
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Fill the input once. Later refetches never overwrite what the user typed.
  const filled = useRef(false);
  useEffect(() => {
    if (data !== undefined && !filled.current) {
      filled.current = true;
      setValue(data?.upiId ?? "");
    }
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v && !UPI.test(v)) return setErr("Enter a valid UPI ID (name@bank)");
    setErr("");
    setBusy(true);
    try {
      // The settings doc is created on first save, not on first read.
      const doc = data?._id
        ? await client.patch(data._id).set({ upiId: v }).commit()
        : await client.create({
            _type: "settings",
            title: "Global Settings",
            freeSocksOffer: false,
            shoeCleanerAddon: false,
            upiId: v,
          });
      mutate(() => ({ _id: doc._id, upiId: v }));
      setValue(v);
      toast.success("UPI ID saved");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save UPI ID");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Settings." count="Site" />

      <div className="mt-8">
        {data === undefined ? (
          <Skeleton rows={1} />
        ) : (
          <form onSubmit={save} className="space-y-3 rounded-3xl bg-neutral-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-600 to-emerald-400">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-tight">UPI ID</p>
                <p className="text-xs font-medium text-neutral-500">
                  Checkout payments go to this ID
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="name@bank"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={`${inputCls} !bg-white`}
              />
              <Btn
                type="submit"
                variant="primary"
                className="h-12"
                loading={busy}
                disabled={value.trim() === (data?.upiId ?? "")}
              >
                Save
              </Btn>
            </div>
            {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
          </form>
        )}
      </div>
    </>
  );
}