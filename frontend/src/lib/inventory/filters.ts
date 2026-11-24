export type InventoryFilters = { query: string; stock: string; archived: boolean; minYear: string; maxYear: string; transmission: string; currency: string; minPrice: string; maxPrice: string };
export const emptyInventoryFilters: InventoryFilters = { query: "", stock: "", archived: false, minYear: "", maxYear: "", transmission: "", currency: "", minPrice: "", maxPrice: "" };
export function yearFilterError(filters: InventoryFilters) {
  if ([filters.minYear, filters.maxYear].some(value => value && !/^[1-9]\d{3}$/.test(value))) return "Ingresá años de cuatro dígitos.";
  if (filters.minYear && filters.maxYear && Number(filters.minYear) > Number(filters.maxYear)) return "El año desde no puede superar al año hasta.";
  return null;
}
export function yearFilterSummary(filters: InventoryFilters) {
  return [filters.minYear ? `Desde ${filters.minYear}` : "", filters.maxYear ? `Hasta ${filters.maxYear}` : ""].filter(Boolean).join(" · ");
}
export function priceFilterError(filters: InventoryFilters): string | null {
  const { currency, minPrice, maxPrice } = filters;
  if (currency && !["ARS", "USD"].includes(currency)) return "Elegí ARS o USD para filtrar precios.";
  if ((minPrice || maxPrice) && !currency) return "Elegí una moneda para aplicar el rango de precios.";
  for (const value of [minPrice, maxPrice]) {
    if (value && !/^\d{1,12}([.,]\d{1,2})?$/.test(value.trim())) return "Ingresá importes desde cero, sin separadores de miles y con hasta 2 decimales.";
  }
  if (minPrice && maxPrice && Number(minPrice.replace(",", ".")) > Number(maxPrice.replace(",", "."))) return "El precio mínimo no puede superar al máximo.";
  return null;
}
export function priceFilterSummary(filters: InventoryFilters) {
  if (!filters.currency || priceFilterError(filters)) return "";
  const format = (value: string) => Number(value.replace(",", ".")).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return [filters.currency, filters.minPrice ? `desde ${format(filters.minPrice)}` : "", filters.maxPrice ? `hasta ${format(filters.maxPrice)}` : ""].filter(Boolean).join(" ");
}
export function parseInventoryFilters(params: Record<string, string | string[] | undefined>): InventoryFilters {
  const year = typeof params.year === "string" && /^[1-9]\d{3}$/.test(params.year) ? params.year : "";
  return { query: typeof params.q === "string" ? params.q.trim().slice(0, 120) : "",
    stock: params.stock === "available" || params.stock === "empty" ? params.stock : "",
    archived: params.archived === "true", minYear: typeof params.year_min === "string" ? params.year_min.slice(0,10) : year, maxYear: typeof params.year_max === "string" ? params.year_max.slice(0,10) : year,
    currency: typeof params.currency === "string" ? params.currency.slice(0, 10) : "",
    minPrice: typeof params.min_price === "string" ? params.min_price.trim().slice(0, 40) : "",
    maxPrice: typeof params.max_price === "string" ? params.max_price.trim().slice(0, 40) : "",
    transmission: typeof params.transmission === "string" && ["automatic", "manual", "other"].includes(params.transmission) ? params.transmission : "" };
}
export function inventorySearchParams(filters: InventoryFilters, page = 1) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.stock) params.set("stock", filters.stock);
  if (filters.archived) params.set("archived", "true");
  if (filters.minYear) params.set("year_min", filters.minYear);
  if (filters.maxYear) params.set("year_max", filters.maxYear);
  if (filters.transmission) params.set("transmission", filters.transmission);
  if (filters.currency) params.set("currency", filters.currency);
  if (filters.minPrice) params.set("min_price", filters.minPrice);
  if (filters.maxPrice) params.set("max_price", filters.maxPrice);
  if (page > 1) params.set("page", String(page));
  return params;
}
