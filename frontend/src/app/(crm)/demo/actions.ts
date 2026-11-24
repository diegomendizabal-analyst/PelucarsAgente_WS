"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";

export async function setDemoVisible(visible: boolean) {
  await requireAccount();
  if (process.env.PELUCARS_DEMO_TOOLS !== "true" || typeof visible !== "boolean") return { error: "Herramienta de demo no disponible." };
  (await cookies()).set("pelucars-demo-visible", visible ? "1" : "0", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
  revalidatePath("/", "layout");
  return {};
}
