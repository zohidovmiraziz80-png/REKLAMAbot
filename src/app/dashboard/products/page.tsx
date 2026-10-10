import type { Metadata } from "next";
import { runAction } from "@/actions/run";
import { listProducts } from "@/actions/shop";
import { ProductsManager } from "./manager";

export const metadata: Metadata = { title: "Mahsulotlar" };

export default async function ProductsPage() {
  const result = await runAction(listProducts, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  return <ProductsManager initial={result.data} />;
}
