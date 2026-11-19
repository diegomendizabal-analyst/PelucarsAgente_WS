import { Suspense, type ReactNode } from "react";
import { requireAccount } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import Loading from "@/app/loading";

// El acceso se decide con la sesión actual; no se promete navegación instantánea.
export const instant = false;

async function AuthenticatedApp({ children }: { children: ReactNode }) {
  const account = await requireAccount();
  return <AppShell account={account}>{children}</AppShell>;
}
export default function CrmLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="access-page"><Loading /></main>}><AuthenticatedApp>{children}</AuthenticatedApp></Suspense>;
}
