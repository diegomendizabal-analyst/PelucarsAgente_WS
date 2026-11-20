"use client";
export default function InventoryErrorBoundary({ reset }: { reset: () => void }) {
  return <section className="panel panel-body"><h1>No pudimos cargar el inventario</h1><p className="page-description">Intentá nuevamente. Si acababas de guardar, revisá el listado antes de repetir la operación.</p><button className="button secondary" onClick={reset}>Reintentar</button></section>;
}
