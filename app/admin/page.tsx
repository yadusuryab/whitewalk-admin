/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/products/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Inter_Tight } from "next/font/google";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Loader2,
  Check,
} from "lucide-react";
import { client as sanityClient } from "@/lib/sanity";

const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "800"],
  display: "swap",
});

const LABEL_OPTIONS = [
  { title: "Trending", value: "trending" },
  { title: "New Arrival", value: "new-arrival" },
  { title: "Best Seller", value: "best-seller" },
  { title: "Limited Edition", value: "limited-edition" },
  { title: "Sale", value: "sale" },
];

const OFFER_OPTIONS = [
  ["offer1Pair", "1 Pair"],
  ["offer2Pair", "2 Pair"],
  ["offer3Pair", "3 Pair"],
] as const;

const DEFAULT_SIZES = [6, 7, 8, 9, 10];

interface Shoe {
  _id: string;
  orderNumber: number;
  productName: string;
  price: number;
  stock: number;
  isDisabled: boolean;
  images?: any;
  productLabel?: string[];
  sizes?: number[];
  disabledSizes?: number[];
  offer1Pair?: boolean;
  offer2Pair?: boolean;
  offer3Pair?: boolean;
}

type StatusFilter = "all" | "active" | "disabled";
type LabelFilter = "all" | string;

/* ---------- UI atoms ---------- */

const inputCls =
  "h-12 w-full rounded-2xl bg-neutral-100 px-4 text-sm font-medium outline-none transition-all duration-300 placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-950";
const labelCls = "mb-2 block text-sm font-semibold text-neutral-500";
const selectCls =
  "h-9 cursor-pointer rounded-full bg-neutral-100 px-3 text-xs font-semibold outline-none transition-all focus:ring-2 focus:ring-neutral-950";

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
  danger,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold tracking-tight transition-all duration-200 active:scale-90 ${
      danger
        ? active
          ? "bg-red-50 text-red-500 line-through"
          : "bg-neutral-100 hover:bg-neutral-200"
        : active
          ? "bg-neutral-950 text-white"
          : "bg-neutral-100 hover:bg-neutral-200"
    }`}
  >
    {!danger && active && <Check className="h-3 w-3" strokeWidth={3} />}
    {children}
  </button>
);

const StatusPill = ({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-extrabold tracking-tight transition-all duration-300 active:scale-95 ${
      disabled
        ? "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
        : "bg-blue-600/10 text-blue-700 hover:bg-blue-600/20"
    }`}
  >
    {disabled ? (
      <>
        <EyeOff className="h-3.5 w-3.5" /> Disabled
      </>
    ) : (
      <>
        <Eye className="h-3.5 w-3.5" /> Active
      </>
    )}
  </button>
);

const Tag = ({
  children,
  blue,
}: {
  children: React.ReactNode;
  blue?: boolean;
}) => (
  <span
    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
      blue ? "bg-blue-600/10 text-blue-700" : "bg-neutral-100 text-neutral-600"
    }`}
  >
    {children}
  </span>
);

// Small badge showing which offers a product appears in
const OfferChips = ({ shoe }: { shoe: Shoe }) => {
  const on = OFFER_OPTIONS.filter(([k]) =>
    k === "offer1Pair" ? (shoe[k] ?? true) : (shoe[k] ?? false),
  );
  if (!on.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {on.map(([k, t]) => (
        <Tag key={k} blue>
          {t}
        </Tag>
      ))}
    </div>
  );
};

/* ---------- Page ---------- */

export default function ProductsPage() {
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [labelFilter, setLabelFilter] = useState<LabelFilter>("all");
  const [editingProduct, setEditingProduct] = useState<Shoe | null>(null);
  const [editForm, setEditForm] = useState({
    productName: "",
    price: 0,
    orderNumber: 0,
    productLabel: [] as string[],
    disabledSizes: [] as number[],
    offer1Pair: true,
    offer2Pair: false,
    offer3Pair: false,
  });
  const [reorderSaving, setReorderSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [mobileView, setMobileView] = useState(false);

  // Image replacement state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check screen size for responsive design
  useEffect(() => {
    const checkScreenSize = () => {
      setMobileView(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      // Fetch count first so we know the exact ceiling, then fetch all docs.
      // Running them in parallel would race — the docs query needs the count.
      const count = await sanityClient.fetch<number>(`count(*[_type == "shoe"])`);
      setTotalCount(count);

      const data = await sanityClient.fetch<Shoe[]>(
        `*[_type == "shoe"] | order(orderNumber asc) [0...${count + 1}] {
          _id,
          orderNumber,
          productName,
          price,
          stock,
          isDisabled,
          images[0],
          productLabel,
          sizes,
          disabledSizes,
          offer1Pair,
          offer2Pair,
          offer3Pair
        }`,
      );
      setShoes(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Optimized image URL generation using Sanity CDN
  const getOptimizedImageUrl = useCallback((image: any) => {
    if (!image?.asset?._ref) return null;

    const ref = image.asset._ref;

    try {
      const parts = ref.split("-");

      if (parts.length >= 4) {
        const hash = parts[1];
        const dimensions = parts[2];
        const format = parts[3];

        const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
        if (!projectId) return null;

        return `https://cdn.sanity.io/images/${projectId}/production/${hash}-${dimensions}.${format}`;
      }

      const match = ref.match(/image-([^-]+)-(\d+x\d+)-(\w+)/);
      if (match) {
        const [, hash, dimensions, format] = match;
        const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
        return `https://cdn.sanity.io/images/${projectId}/production/${hash}-${dimensions}.${format}`;
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  // Filter and paginate products
  const { filteredProducts, totalPages } = useMemo(() => {
    const filtered = shoes.filter((shoe) => {
      const searchTerm = search.toLowerCase();
      const isNumericSearch = searchTerm !== "" && !isNaN(Number(searchTerm));
      const numericValue = isNumericSearch ? Number(searchTerm) : null;

      const matchesSearch =
        shoe.productName.toLowerCase().includes(searchTerm) ||
        shoe.orderNumber.toString().includes(searchTerm) ||
        shoe._id.toLowerCase().includes(searchTerm) ||
        (isNumericSearch &&
          (shoe.orderNumber === numericValue ||
            shoe.price === numericValue ||
            shoe.stock === numericValue));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "disabled" && shoe.isDisabled) ||
        (statusFilter === "active" && !shoe.isDisabled);

      const matchesLabel =
        labelFilter === "all" || (shoe.productLabel || []).includes(labelFilter);

      return matchesSearch && matchesStatus && matchesLabel;
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    return { filteredProducts: paginated, totalPages };
  }, [shoes, search, statusFilter, labelFilter, currentPage, itemsPerPage]);

  // Toggle product status
  const toggleProductStatus = useCallback(
    async (id: string, currentStatus: boolean) => {
      if (
        !confirm(
          `Are you sure you want to ${currentStatus ? "enable" : "disable"} this product?`,
        )
      )
        return;

      try {
        await sanityClient
          .patch(id)
          .set({ isDisabled: !currentStatus })
          .commit();

        setShoes((prev) =>
          prev.map((shoe) =>
            shoe._id === id ? { ...shoe, isDisabled: !currentStatus } : shoe,
          ),
        );
        // Keep the open modal in sync
        setEditingProduct((prev) =>
          prev && prev._id === id
            ? { ...prev, isDisabled: !currentStatus }
            : prev,
        );
      } catch (error) {
        console.error("Error updating product:", error);
        alert("Failed to update product status");
      }
    },
    [],
  );

  // Delete product
  const deleteProduct = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      await sanityClient.delete(id);
      setShoes((prev) => prev.filter((shoe) => shoe._id !== id));
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product");
    }
  }, []);

  // Edit product
  const startEdit = (product: Shoe) => {
    setEditingProduct(product);
    setEditForm({
      productName: product.productName,
      price: product.price,
      orderNumber: product.orderNumber,
      productLabel: product.productLabel || [],
      disabledSizes: product.disabledSizes || [],
      offer1Pair: product.offer1Pair ?? true,
      offer2Pair: product.offer2Pair ?? false,
      offer3Pair: product.offer3Pair ?? false,
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const closeEdit = () => {
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleEditLabel = (value: string) => {
    setEditForm((prev) => ({
      ...prev,
      productLabel: prev.productLabel.includes(value)
        ? prev.productLabel.filter((v) => v !== value)
        : [...prev.productLabel, value],
    }));
  };

  const toggleEditSize = (size: number) => {
    setEditForm((prev) => ({
      ...prev,
      disabledSizes: prev.disabledSizes.includes(size)
        ? prev.disabledSizes.filter((s) => s !== size)
        : [...prev.disabledSizes, size],
    }));
  };

  const toggleEditOffer = (key: (typeof OFFER_OPTIONS)[number][0]) => {
    setEditForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Only JPEG, PNG, WebP, and AVIF are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Maximum size is 10MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImageSelection = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveEdit = async () => {
    if (!editingProduct) return;

    try {
      // Upload new image first if one was selected
      if (imageFile) {
        setUploadingImage(true);

        const formData = new FormData();
        formData.append("image", imageFile);

        const res = await fetch(`/api/products/${editingProduct._id}/image`, {
          method: "PUT",
          body: formData,
        });

        // Guard against HTML error pages (404, 500, etc.)
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Upload failed (HTTP ${res.status}). Check that the API route exists at app/api/products/[id]/image/route.ts`,
          );
        }

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Image upload failed");
        }

        const { imageRef } = payload;

        setShoes((prev) =>
          prev.map((shoe) =>
            shoe._id === editingProduct._id
              ? {
                  ...shoe,
                  images: {
                    _type: "image",
                    asset: { _type: "reference", _ref: imageRef },
                  },
                }
              : shoe,
          ),
        );

        setUploadingImage(false);
      }

      const oldOrderNumber = editingProduct.orderNumber;
      // Clamp to [1, totalCount] — totalCount comes from Sanity directly,
      // so it's always correct even if shoes[] only partially loaded.
      const finalOrderNumber = Math.max(
        1,
        Math.min(editForm.orderNumber, totalCount),
      );
      const orderChanged = finalOrderNumber !== oldOrderNumber;

      if (orderChanged) {
        setReorderSaving(true);

        // Fetch ALL product IDs + orderNumbers straight from Sanity.
        // We cannot use the local shoes[] array for reordering because Sanity
        // silently caps fetches — shoes[] may only contain a subset of products,
        // which causes splice-based reordering to cap at the wrong maximum.
        const allShoes = await sanityClient.fetch<
          { _id: string; orderNumber: number }[]
        >(
          `*[_type == "shoe"] | order(orderNumber asc) [0...${totalCount + 100}] { _id, orderNumber }`,
        );

        // Remove the edited shoe, insert at the target position, re-sequence.
        const withoutEdited = allShoes.filter(
          (s) => s._id !== editingProduct._id,
        );
        withoutEdited.splice(finalOrderNumber - 1, 0, {
          _id: editingProduct._id,
          orderNumber: finalOrderNumber,
        });
        const reordered = withoutEdited.map((s, idx) => ({
          ...s,
          orderNumber: idx + 1,
        }));

        // Only patch docs whose orderNumber actually changed
        const changed = reordered.filter((s) => {
          const orig = allShoes.find((o) => o._id === s._id);
          return orig && orig.orderNumber !== s.orderNumber;
        });

        // Batch in groups of 50 to avoid rate-limiting Sanity
        const BATCH = 50;
        for (let i = 0; i < changed.length; i += BATCH) {
          await Promise.all(
            changed
              .slice(i, i + BATCH)
              .map((s) =>
                sanityClient
                  .patch(s._id)
                  .set({ orderNumber: s.orderNumber })
                  .commit(),
              ),
          );
        }

        // Update local state order numbers for docs we have in memory
        setShoes((prev) => {
          const orderMap = new Map(
            reordered.map((s) => [s._id, s.orderNumber]),
          );
          return prev
            .map((s) => ({
              ...s,
              orderNumber: orderMap.get(s._id) ?? s.orderNumber,
            }))
            .sort((a, b) => a.orderNumber - b.orderNumber);
        });

        setReorderSaving(false);
      }

      // Patch name + price + label + sizes + offers + final order number for the edited shoe
      await sanityClient
        .patch(editingProduct._id)
        .set({
          productName: editForm.productName,
          price: editForm.price,
          orderNumber: finalOrderNumber,
          productLabel: editForm.productLabel,
          disabledSizes: editForm.disabledSizes,
          offer1Pair: editForm.offer1Pair,
          offer2Pair: editForm.offer2Pair,
          offer3Pair: editForm.offer3Pair,
        })
        .commit();

      setShoes((prev) =>
        prev
          .map((shoe) =>
            shoe._id === editingProduct._id
              ? {
                  ...shoe,
                  productName: editForm.productName,
                  price: editForm.price,
                  orderNumber: finalOrderNumber,
                  productLabel: editForm.productLabel,
                  disabledSizes: editForm.disabledSizes,
                  offer1Pair: editForm.offer1Pair,
                  offer2Pair: editForm.offer2Pair,
                  offer3Pair: editForm.offer3Pair,
                }
              : shoe,
          )
          .sort((a, b) => a.orderNumber - b.orderNumber),
      );

      closeEdit();
    } catch (error: any) {
      console.error("Error updating product:", error);
      alert(error.message || "Failed to update product");
      setUploadingImage(false);
      setReorderSaving(false);
    }
  };

  // Pagination controls
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  const orderTaken =
    editingProduct &&
    editForm.orderNumber !== editingProduct.orderNumber &&
    editForm.orderNumber <= totalCount &&
    shoes.find(
      (s) =>
        s.orderNumber === editForm.orderNumber && s._id !== editingProduct._id,
    );

  return (
    <div
      className={`${display.className} min-h-screen bg-white px-4 py-6 text-neutral-950 md:px-8`}
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="duration-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="inline-flex items-center gap-2 rounded-md bg-blue-600/10 px-3.5 py-1.5 text-sm font-semibold text-blue-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
            {totalCount} products
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <h1 className="text-balance text-5xl font-extrabold leading-[0.9] tracking-[-0.045em] md:text-7xl">
              Products.
            </h1>
            <Link href="/admin/products/new">
              <Btn variant="primary" className="h-12">
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Add shoe</span>
              </Btn>
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-8 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by ID, name, or order number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className={`${inputCls} pl-11`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-500">
              {filteredProducts.length} of {shoes.length} products
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter);
                  setCurrentPage(1);
                }}
                className={selectCls}
              >
                <option value="all">All status</option>
                <option value="active">Active only</option>
                <option value="disabled">Disabled only</option>
              </select>
              <select
                value={labelFilter}
                onChange={(e) => {
                  setLabelFilter(e.target.value as LabelFilter);
                  setCurrentPage(1);
                }}
                className={selectCls}
              >
                <option value="all">All labels</option>
                {LABEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.title}
                  </option>
                ))}
              </select>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={selectCls}
              >
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 p-3 backdrop-blur-md duration-300 animate-in fade-in md:p-4">
            <div
              className={`${display.className} max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-white text-neutral-950 duration-300 animate-in zoom-in-95 slide-in-from-bottom-4`}
            >
              <div className="p-5 md:p-6">
                <div className="mb-5 flex items-start justify-between">
                  <h3 className="text-4xl font-extrabold leading-[0.92] tracking-[-0.045em]">
                    Edit
                    <br />
                    product.
                  </h3>
                  <Btn onClick={closeEdit} icon title="Close">
                    <X className="h-4 w-4" />
                  </Btn>
                </div>

                {/* Product Image with Replace Option */}
                <div className="mb-6">
                  <label className={labelCls}>Product image</label>

                  <div className="relative mx-auto mb-3 aspect-square w-full max-w-[200px] overflow-hidden rounded-[1.5rem] bg-neutral-100">
                    {imagePreview ? (
                      <>
                        <Image
                          src={imagePreview}
                          alt="New image preview"
                          fill
                          sizes="200px"
                          className="object-cover duration-500 animate-in fade-in zoom-in-95"
                        />
                        <button
                          type="button"
                          onClick={clearImageSelection}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-neutral-950 backdrop-blur transition-all hover:bg-white active:scale-90"
                          title="Remove selected image"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-blue-600 py-1.5 text-center text-xs font-semibold text-white">
                          New image selected
                        </div>
                      </>
                    ) : getOptimizedImageUrl(editingProduct.images) ? (
                      <Image
                        src={getOptimizedImageUrl(editingProduct.images) || ""}
                        alt={editingProduct.productName}
                        fill
                        sizes="200px"
                        className="object-cover"
                        quality={80}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-400">
                        <ImageIcon className="h-10 w-10" />
                        <span className="text-xs font-semibold">No image</span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-replace-input"
                  />

                  <Btn
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4" />
                    {imageFile ? "Change selected image" : "Replace image"}
                  </Btn>
                  <p className="mt-2 text-center text-xs font-medium text-neutral-400">
                    JPEG, PNG, WebP or AVIF · Max 10MB
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className={labelCls}>Product name</label>
                    <input
                      type="text"
                      value={editForm.productName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, productName: e.target.value })
                      }
                      className={inputCls}
                      placeholder="Enter product name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Order number</label>
                      <input
                        type="number"
                        min={1}
                        value={editForm.orderNumber}
                        onChange={(e) => {
                          // Allow free typing — do NOT clamp here so mid-type values work
                          const raw = parseInt(e.target.value) || 1;
                          setEditForm({ ...editForm, orderNumber: raw });
                        }}
                        onBlur={(e) => {
                          // Clamp only when the user leaves the field
                          const raw = parseInt(e.target.value) || 1;
                          const clamped = Math.max(
                            1,
                            Math.min(raw, totalCount),
                          );
                          setEditForm({ ...editForm, orderNumber: clamped });
                        }}
                        className={`${inputCls} ${
                          editForm.orderNumber !== editingProduct.orderNumber
                            ? "!bg-amber-50 ring-2 ring-amber-400 focus:!ring-amber-400"
                            : ""
                        }`}
                      />
                      {editForm.orderNumber !== editingProduct.orderNumber && (
                        <p className="mt-2 text-xs font-semibold text-amber-600 duration-300 animate-in fade-in slide-in-from-top-1">
                          {editForm.orderNumber > totalCount
                            ? `Max is ${totalCount} — will be placed last`
                            : orderTaken
                              ? `#${editForm.orderNumber} is taken — products will shift`
                              : "Other products will be re-numbered"}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={labelCls}>Price (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.price}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            price: parseFloat(e.target.value) || 0,
                          })
                        }
                        className={inputCls}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Product label</label>
                    <div className="flex flex-wrap gap-2">
                      {LABEL_OPTIONS.map((opt) => (
                        <Chip
                          key={opt.value}
                          active={editForm.productLabel.includes(opt.value)}
                          onClick={() => toggleEditLabel(opt.value)}
                        >
                          {opt.title}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Show in offers</label>
                    <div className="flex flex-wrap gap-2">
                      {OFFER_OPTIONS.map(([key, title]) => (
                        <Chip
                          key={key}
                          active={editForm[key]}
                          onClick={() => toggleEditOffer(key)}
                        >
                          {title}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>
                      Sizes{" "}
                      <span className="font-medium text-neutral-400">
                        (tap to disable)
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(editingProduct.sizes?.length
                        ? editingProduct.sizes
                        : DEFAULT_SIZES
                      ).map((size) => (
                        <Chip
                          key={size}
                          danger
                          active={editForm.disabledSizes.includes(size)}
                          onClick={() => toggleEditSize(size)}
                        >
                          {size}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-3xl bg-neutral-100 p-4">
                    <div>
                      <p className="text-sm font-extrabold tracking-tight">
                        Status
                      </p>
                      <p className="text-xs font-medium text-neutral-500">
                        {editingProduct.isDisabled ? "Disabled" : "Active"}
                      </p>
                    </div>
                    <StatusPill
                      disabled={editingProduct.isDisabled}
                      onClick={() =>
                        toggleProductStatus(
                          editingProduct._id,
                          editingProduct.isDisabled,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-neutral-200 pt-5">
                  <Btn onClick={closeEdit}>Cancel</Btn>
                  <Btn
                    onClick={saveEdit}
                    variant="primary"
                    disabled={uploadingImage || reorderSaving}
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : reorderSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Reordering…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products */}
        <div className="mt-6">
          {mobileView ? (
            /* Mobile card view */
            <div className="space-y-3">
              {filteredProducts.map((shoe, i) => {
                const imageUrl = getOptimizedImageUrl(shoe.images);

                return (
                  <div
                    key={shoe._id}
                    style={{
                      animationDelay: `${(i % 10) * 45}ms`,
                      animationFillMode: "both",
                    }}
                    className={`rounded-[1.75rem] p-3 duration-500 animate-in fade-in slide-in-from-bottom-3 ${
                      shoe.isDisabled ? "bg-neutral-50 opacity-70" : "bg-neutral-100"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {imageUrl ? (
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-white">
                          <Image
                            src={imageUrl}
                            alt={shoe.productName}
                            fill
                            sizes="80px"
                            className="object-cover"
                            loading="lazy"
                            quality={70}
                          />
                        </div>
                      ) : (
                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-white">
                          <ImageIcon className="h-6 w-6 text-neutral-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400">
                          #{shoe.orderNumber}
                        </p>
                        <p className="truncate text-base font-extrabold leading-tight tracking-tight">
                          {shoe.productName}
                        </p>
                        <p className="text-2xl font-extrabold leading-none tracking-[-0.04em]">
                          ₹{shoe.price}
                        </p>
                        {shoe.productLabel && shoe.productLabel.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {shoe.productLabel.map((label) => (
                              <Tag key={label}>
                                {LABEL_OPTIONS.find((o) => o.value === label)
                                  ?.title || label}
                              </Tag>
                            ))}
                          </div>
                        )}
                        <OfferChips shoe={shoe} />
                        {!!shoe.disabledSizes?.length && (
                          <p className="mt-1.5 text-[11px] font-semibold text-red-500">
                            Sizes off: {shoe.disabledSizes.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <StatusPill
                        disabled={shoe.isDisabled}
                        onClick={() =>
                          toggleProductStatus(shoe._id, shoe.isDisabled)
                        }
                      />
                      <div className="flex items-center gap-2">
                        <Btn
                          onClick={() => startEdit(shoe)}
                          className="!bg-white hover:!bg-neutral-200"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Btn>
                        <Btn
                          onClick={() => deleteProduct(shoe._id)}
                          icon
                          variant="danger"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Btn>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop table view */
            <div className="overflow-x-auto rounded-[1.75rem] bg-neutral-100 p-2">
              <table className="min-w-full">
                <thead>
                  <tr>
                    {[
                      "Order #",
                      "Product",
                      "Price",
                      "Label",
                      "Offers",
                      "Sizes off",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((shoe, i) => {
                    const imageUrl = getOptimizedImageUrl(shoe.images);

                    return (
                      <tr
                        key={shoe._id}
                        style={{
                          animationDelay: `${(i % 10) * 35}ms`,
                          animationFillMode: "both",
                        }}
                        className={`group border-t border-neutral-200 duration-500 animate-in fade-in slide-in-from-bottom-2 transition-colors hover:bg-white ${
                          shoe.isDisabled ? "opacity-60" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-lg font-extrabold tracking-tight">
                          {shoe.orderNumber}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {imageUrl ? (
                              <div className="relative mr-3 h-12 w-12 flex-shrink-0 overflow-hidden rounded-2xl bg-white">
                                <Image
                                  src={imageUrl}
                                  alt={shoe.productName}
                                  fill
                                  sizes="48px"
                                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                                  loading="lazy"
                                  quality={70}
                                />
                              </div>
                            ) : (
                              <div className="mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white">
                                <ImageIcon className="h-5 w-5 text-neutral-300" />
                              </div>
                            )}
                            <p className="max-w-[200px] truncate text-sm font-extrabold tracking-tight">
                              {shoe.productName}
                            </p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-sm font-extrabold tracking-tight">
                          ₹{shoe.price}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex max-w-[160px] flex-wrap gap-1">
                            {(shoe.productLabel || []).map((label) => (
                              <Tag key={label}>
                                {LABEL_OPTIONS.find((o) => o.value === label)
                                  ?.title || label}
                              </Tag>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <OfferChips shoe={shoe} />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {shoe.disabledSizes?.length ? (
                            <span className="font-semibold text-red-500">
                              {shoe.disabledSizes.join(", ")}
                            </span>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusPill
                            disabled={shoe.isDisabled}
                            onClick={() =>
                              toggleProductStatus(shoe._id, shoe.isDisabled)
                            }
                          />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Btn
                              onClick={() => startEdit(shoe)}
                              className="!bg-white hover:!bg-neutral-200"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Btn>
                            <Btn
                              onClick={() => deleteProduct(shoe._id)}
                              icon
                              variant="danger"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="py-16 text-center duration-500 animate-in fade-in">
              <p className="text-3xl font-extrabold tracking-[-0.04em]">
                No products found.
              </p>
              {(search || statusFilter !== "all" || labelFilter !== "all") && (
                <Btn
                  className="mt-4"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setLabelFilter("all");
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
              Page {currentPage} of {totalPages}
            </p>

            <div className="flex items-center gap-1.5">
              <Btn
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                icon
              >
                <ChevronLeft className="h-4 w-4" />
              </Btn>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Btn
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    icon
                    variant={currentPage === pageNum ? "primary" : "soft"}
                  >
                    {pageNum}
                  </Btn>
                );
              })}

              <Btn
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                icon
              >
                <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}