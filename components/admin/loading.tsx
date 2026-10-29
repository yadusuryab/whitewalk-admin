import { Skeleton } from "@/components/admin/ui";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-24 w-64 animate-pulse rounded-3xl bg-neutral-100" />
      <Skeleton rows={6} />
    </div>
  );
}