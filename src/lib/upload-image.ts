/**
 * Brauzerda rasmni kichraytirib (≤1600px, JPEG) serverga yuklaydi va ommaviy manzilini qaytaradi.
 * Mahsulot rasmlari va sayt rasmlari uchun umumiy.
 */

async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadImage(file: File, maxSide = 1600): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) return { ok: false, error: "Faqat rasm fayl tanlang" };
  try {
    const blob = await shrinkImage(file, maxSide);
    const form = new FormData();
    form.append("file", new File([blob], "image.jpg", { type: blob.type || "image/jpeg" }));
    const res = await fetch("/api/uploads/product-image", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
    return data.ok && data.url ? { ok: true, url: data.url } : { ok: false, error: data.error ?? "Rasm yuklanmadi" };
  } catch {
    return { ok: false, error: "Rasm yuklanmadi" };
  }
}
