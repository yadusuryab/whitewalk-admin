/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/products/new/page.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { client as sanityClient } from "@/lib/sanity";
import { compressImage, compressVideo } from "@/lib/compress";
import { ArrowLeft, Upload, X, Video, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
const MAX_VIDEO_MB = 10; // target size AFTER compression
const MAX_INPUT_VIDEO_MB = 300; // largest raw file we'll try to compress

export default function NewProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressingImages, setCompressingImages] = useState(false);
  const [compressingVideo, setCompressingVideo] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);

  const [formData, setFormData] = useState({
    orderNumber: 0,
    productName: "",
    price: 0,
  });

  const [productLabel, setProductLabel] = useState<string[]>([]);

  const [offers, setOffers] = useState({
    offer1Pair: true,
    offer2Pair: false,
    offer3Pair: false,
  });

  const [images, setImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState("");

  const [video, setVideo] = useState<File | null>(null);
  const [videoError, setVideoError] = useState("");

  const toggleLabel = (value: string) => {
    setProductLabel((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  // Handle image selection (compress each before adding)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const picked = Array.from(files).slice(0, 10);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setCompressingImages(true);
    setImageError("");
    try {
      const compressed = await Promise.all(picked.map((f) => compressImage(f)));
      setImages((prev) => [...prev, ...compressed]);
    } catch (err) {
      console.error(err);
      setImageError("Failed to process one or more images");
    } finally {
      setCompressingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle video selection (compress to under MAX_VIDEO_MB)
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setVideoError("Please select a video file");
      return;
    }
    if (file.size > MAX_INPUT_VIDEO_MB * 1024 * 1024) {
      setVideoError(`Video must be under ${MAX_INPUT_VIDEO_MB}MB`);
      return;
    }

    setVideoError("");
    setCompressingVideo(true);
    setCompressProgress(0);
    try {
      const compressed = await compressVideo(file, MAX_VIDEO_MB, setCompressProgress);
      if (compressed.size > MAX_VIDEO_MB * 1024 * 1024) {
        setVideoError(
          `Couldn't compress below ${MAX_VIDEO_MB}MB. Try a shorter clip.`,
        );
        return;
      }
      setVideo(compressed);
    } catch (err) {
      console.error("Video compression failed:", err);
      setVideoError("Video compression failed. Try a different file.");
    } finally {
      setCompressingVideo(false);
    }
  };

  const removeVideo = () => {
    setVideo(null);
    setVideoError("");
  };

  const uploadImagesToSanity = async (): Promise<any[]> => {
    if (images.length === 0) return [];

    setUploadingImages(true);
    setUploadProgress(0);

    const uploaded: any[] = [];

    try {
      for (let i = 0; i < images.length; i++) {
        const file = images[i];

        try {
          const asset = await sanityClient.assets.upload("image", file, {
            filename: file.name,
            contentType: file.type,
          });

          uploaded.push({
            _type: "image",
            _key: `img-${Date.now()}-${i}`,
            asset: { _type: "reference", _ref: asset._id },
          });

          setUploadProgress(Math.round(((i + 1) / images.length) * 100));
        } catch (err) {
          console.error("Failed to upload image:", err);
          throw new Error(`Failed to upload image: ${file.name}`);
        }
      }
    } finally {
      setUploadingImages(false);
    }

    return uploaded;
  };

  const uploadVideoToSanity = async (): Promise<any | null> => {
    if (!video) return null;

    setUploadingVideo(true);

    try {
      const asset = await sanityClient.assets.upload("file", video, {
        filename: video.name,
        contentType: video.type,
      });

      return {
        _type: "file",
        asset: { _type: "reference", _ref: asset._id },
      };
    } catch (err) {
      console.error("Failed to upload video:", err);
      throw new Error(`Failed to upload video: ${video.name}`);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (images.length === 0) {
      setImageError("Please upload at least one image");
      setLoading(false);
      return;
    }

    if (!formData.orderNumber || formData.orderNumber <= 0) {
      setError("Order number must be greater than 0");
      setLoading(false);
      return;
    }

    if (!formData.price || formData.price <= 0) {
      setError("Price must be greater than 0");
      setLoading(false);
      return;
    }

    if (!formData.productName.trim()) {
      setError("Product name is required");
      setLoading(false);
      return;
    }

    if (!offers.offer1Pair && !offers.offer2Pair && !offers.offer3Pair) {
      setError("Select at least one offer (1, 2 or 3 pair)");
      setLoading(false);
      return;
    }

    try {
      const uploadedImages = await uploadImagesToSanity();
      const uploadedVideo = await uploadVideoToSanity();

      const allProducts = await sanityClient.fetch(`
        *[_type == "shoe"] | order(orderNumber asc) [0...100000] {
          _id,
          orderNumber
        }
      `);

      const productsToShift = allProducts.filter(
        (product: any) => product.orderNumber >= formData.orderNumber,
      );

      const transaction = sanityClient.transaction();

      productsToShift
        .sort((a: any, b: any) => b.orderNumber - a.orderNumber)
        .forEach((product: any) => {
          transaction.patch(product._id, {
            set: { orderNumber: product.orderNumber + 1 },
          });
        });

      transaction.create({
        _type: "shoe",
        orderNumber: formData.orderNumber,
        productName: formData.productName.trim(),
        price: formData.price,
        images: uploadedImages,
        ...(uploadedVideo ? { video: uploadedVideo } : {}),
        productLabel,
        sizes: DEFAULT_SIZES,
        disabledSizes: [],
        offer1Pair: offers.offer1Pair,
        offer2Pair: offers.offer2Pair,
        offer3Pair: offers.offer3Pair,
        isOffer: false,
        stock: 10,
        isDisabled: false,
        category: "sneakers",
        shoeBrand: "whitewalk",
      });

      await transaction.commit();

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      console.error("Error creating product:", err);

      const msg: string = err?.message || "";
      if (msg.includes("already exists")) {
        setError(
          "A product with this order number already exists. Try a different order number.",
        );
      } else if (msg.includes("unique")) {
        setError("Order number conflict. Please try a different order number.");
      } else {
        setError(msg || "Failed to create product");
      }
    } finally {
      setLoading(false);
    }
  };

  const busy =
    loading ||
    uploadingImages ||
    uploadingVideo ||
    compressingImages ||
    compressingVideo;

  return (
    <div className="space-y-6 p-4 md:max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/" className="text-gray-600 hover:text-gray-900">
          <Button size="icon" variant={"outline"}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Shoe</h1>
          <p className="text-muted-foreground font-semibold tracking-tight">
            Fill name, order number, price, offers, images and video
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white p-3">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Number *
              </label>
              <input
                type="number"
                value={formData.orderNumber || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    orderNumber: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border  rounded-lg"
                placeholder="e.g., 472"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) =>
                  setFormData({ ...formData, productName: e.target.value })
                }
                className="w-full px-3 py-2 border  rounded-lg"
                placeholder="Name of the product."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border  rounded-lg"
                placeholder="e.g., 999"
                required
                min="0.01"
              />
            </div>
          </div>

          {/* Product Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Label
            </label>
            <div className="flex flex-wrap gap-3">
              {LABEL_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={productLabel.includes(opt.value)}
                    onChange={() => toggleLabel(opt.value)}
                  />
                  {opt.title}
                </label>
              ))}
            </div>
          </div>

          {/* Offers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Show in offers
            </label>
            <div className="flex flex-wrap gap-3">
              {OFFER_OPTIONS.map(([key, title]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={offers[key]}
                    onChange={() =>
                      setOffers((o) => ({ ...o, [key]: !o[key] }))
                    }
                  />
                  {title}
                </label>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Images *
            </label>

            {imageError && (
              <p className="text-red-600 text-sm mb-2">{imageError}</p>
            )}

            <div className="mt-1">
              <div
                onClick={() => !busy && fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition cursor-pointer"
              >
                {compressingImages ? (
                  <>
                    <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-600">Optimizing images...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      Click to upload images or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Any size. Auto-compressed to WebP
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            </div>

            {images.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Selected Images ({images.length})
                </h3>

                {uploadingImages && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Uploading images...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {image.name} ({(image.size / 1024 / 1024).toFixed(1)}MB)
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Video (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Video (optional)
            </label>

            {videoError && (
              <p className="text-red-600 text-sm mb-2">{videoError}</p>
            )}

            {compressingVideo ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Loader2 className="h-10 w-10 text-blue-600 mx-auto mb-3 animate-spin" />
                <p className="text-gray-600">
                  Compressing video... {compressProgress}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${compressProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Runs in your browser. Keep this tab open.
                </p>
              </div>
            ) : !video ? (
              <div
                onClick={() => videoInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition cursor-pointer"
              >
                <Video className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Click to upload a video</p>
                <p className="text-sm text-gray-500 mt-1">
                  Any video up to {MAX_INPUT_VIDEO_MB}MB. Auto-compressed to
                  under {MAX_VIDEO_MB}MB
                </p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative max-w-xs">
                <video
                  src={URL.createObjectURL(video)}
                  controls
                  muted
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
                <button
                  type="button"
                  onClick={removeVideo}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {video.name} ({(video.size / 1024 / 1024).toFixed(1)}MB)
                </p>
                {uploadingVideo && (
                  <p className="text-sm text-blue-600 mt-1">
                    Uploading video...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <Link href="/admin">
              <Button type="button" variant={"outline"}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={busy}
              className="disabled:opacity-50"
            >
              {busy ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {compressingImages || compressingVideo
                    ? "Compressing..."
                    : uploadingImages || uploadingVideo
                      ? "Uploading..."
                      : "Creating..."}
                </>
              ) : (
                "Create Product"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}