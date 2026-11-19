import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";
import type { CurrentAccount } from "@/lib/auth/types";
import { UserManagement } from "@/components/user-management";
import Loading from "@/app/loading";

export const metadata = { title: "Usuarios" };
async function Users() {
  await requireAdmin();
  const client = await createSessionClient();
  const { data, error } = await client.rpc("list_managed_users");
  return <UserManagement users={(data as CurrentAccount[] | null) ?? []} available={!error && !!process.env.SUPABASE_SECRET_KEY} loadError={!!error} />;
}
export default function UsersPage() { return <Suspense fallback={<Loading />}><Users /></Suspense>; }
