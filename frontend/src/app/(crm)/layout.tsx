import { Suspense, type ReactNode } from "react";
import { requireAccount } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import Loading from "@/app/loading";
import { getDataMode } from "@/lib/demo-mode";

// El acceso se decide con la sesión actual; no se promete navegación instantánea.
export const instant = false;

async function AuthenticatedApp({ children }: { children: ReactNode }) {
  const [account, mode] = await Promise.all([requireAccount(), getDataMode()]);
  return <AppShell account={account} demoTools={mode.toolsEnabled} demoVisible={mode.visible}>{children}</AppShell>;
}
export default function CrmLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="access-page"><Loading /></main>}><AuthenticatedApp>{children}</AuthenticatedApp></Suspense>;
}
