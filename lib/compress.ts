// lib/compress.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
let ffmpegInstance: any = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ff = new FFmpeg();
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
  await ff.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegInstance = ff;
  return ff;
}

// Re-encodes to H.264 MP4, retrying with stronger settings until under maxMB
export async function compressVideo(
  file: File,
  maxMB = 10,
  onProgress?: (pct: number) => void,
): Promise<File> {
  if (file.size <= maxMB * 1024 * 1024 && file.type === "video/mp4") return file;

  const { fetchFile } = await import("@ffmpeg/util");
  const ff = await getFFmpeg();
  const ext = file.name.split(".").pop() || "mp4";
  const input = `input.${ext}`;
  const output = "output.mp4";

  const handler = ({ progress }: { progress: number }) =>
    onProgress?.(Math.min(100, Math.round(progress * 100)));
  ff.on("progress", handler);

  const attempts = [
    { width: 720, crf: 28 },
    { width: 540, crf: 32 },
    { width: 480, crf: 36 },
  ];

  try {
    await ff.writeFile(input, await fetchFile(file));
    let result: File | null = null;

    for (const { width, crf } of attempts) {
      await ff.exec([
        "-i", input,
        "-vf", `scale='min(${width},iw)':-2`,
        "-c:v", "libx264",
        "-crf", String(crf),
        "-preset", "veryfast",
        "-an",
        "-movflags", "+faststart",
        output,
      ]);
      const data = (await ff.readFile(output)) as Uint8Array;
      result = new File([data as BlobPart], file.name.replace(/\.\w+$/, "") + ".mp4", {
        type: "video/mp4",
      });
      if (result.size <= maxMB * 1024 * 1024) break;
    }
    return result!;
  } finally {
    ff.off("progress", handler);
    try { await ff.deleteFile(input); } catch {}
    try { await ff.deleteFile(output); } catch {}
  }
}

// Resizes to max 2000px and converts to WebP; keeps original if not smaller
export async function compressImage(file: File, maxDim = 2000, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
}