import { Suspense } from "react";
import { redirect } from "next/navigation";
import Loading from "@/app/loading";
import { requireAccount } from "@/lib/auth/session";
export default function Home() { return <Suspense fallback={<Loading />}><Entry /></Suspense>; }
async function Entry() {
  const account = await requireAccount();
  return redirect(account.role === "admin" ? "/reportes" : "/oportunidades");
}
