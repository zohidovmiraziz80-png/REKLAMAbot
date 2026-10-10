"use server";

import { runAction } from "@/actions/run";
import { updateCustomer } from "@/actions/shop";

export async function updateCustomerAction(id: string, note: string) {
  return runAction(updateCustomer, { id, note });
}
