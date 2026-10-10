"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { deleteProduct, saveProduct, setProductActive } from "@/actions/shop";

export async function saveProductAction(input: unknown) {
  const r = await runAction(saveProduct, input);
  if (r.ok) revalidatePath("/dashboard/products");
  return r;
}

export async function setProductActiveAction(id: string, isActive: boolean) {
  return runAction(setProductActive, { id, isActive });
}

export async function deleteProductAction(id: string) {
  // Foydalanuvchi tasdiqlash oynasini bosgandan keyin chaqiriladi
  const r = await runAction(deleteProduct, { id }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/products");
  return r;
}
