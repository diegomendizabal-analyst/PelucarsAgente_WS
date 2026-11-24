import { Suspense } from "react";
import Loading from "@/app/loading";
import { requireAccount } from "@/lib/auth/session";
import { inventoryYears, listVehicles, pageNumber } from "@/lib/inventory/data";
import { parseInventoryFilters } from "@/lib/inventory/filters";
import { InventoryError, VehicleCatalog } from "@/components/inventory-views";
export const metadata = { title: "Vehículos" };
type Search = Promise<Record<string, string | string[] | undefined>>;
async function Catalog({ searchParams }: { searchParams: Search }) {
  const [account, params] = await Promise.all([requireAccount(), searchParams]);
  const filters = parseInventoryFilters(params);
  const page = pageNumber(params.page);
  const [data, options] = await Promise.all([listVehicles(filters, page), inventoryYears()]);
  if (options.error) return <InventoryError />;
  return <VehicleCatalog {...data} page={page} filters={filters} years={options.years} admin={account.role === "admin"} />;
}
export default function Page({ searchParams }: { searchParams: Search }) { return <Suspense fallback={<Loading />}><Catalog searchParams={searchParams} /></Suspense>; }
