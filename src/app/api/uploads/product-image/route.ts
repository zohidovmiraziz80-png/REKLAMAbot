import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";

/**
 * Mahsulot rasmini yuklash. Brauzer rasmni oldindan kichraytiradi (≤1600px, JPEG/WebP).
 * Fayl Supabase Storage'ning ommaviy "product-images" bucket'iga <workspace>/<uuid> nomi bilan tushadi.
 */

export const dynamic = "force-dynamic";

const BUCKET = "product-images";
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Avval tizimga kiring" }, { status: 401 });
  const workspace = await getActiveWorkspace(supabase, user.id);
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace topilmadi" }, { status: 403 });

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    file = null;
  }
  if (!file) return NextResponse.json({ ok: false, error: "Fayl topilmadi" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ ok: false, error: "Faqat JPG, PNG yoki WebP rasm" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Rasm 3 MB dan katta" }, { status: 400 });

  const db = createAdminClient();
  const path = `${workspace.id}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = () => db.storage.from(BUCKET).upload(path, bytes, { contentType: file!.type, cacheControl: "31536000", upsert: false });

  let { error } = await upload();
  if (error && /bucket not found|not found/i.test(error.message)) {
    await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: Object.keys(TYPES) });
    ({ error } = await upload());
  }
  if (error) {
    console.error("Rasm yuklash xatosi:", error.message);
    return NextResponse.json({ ok: false, error: "Rasm yuklanmadi" }, { status: 500 });
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
