export default function Loading() {
  return <section className="panel loading-panel" role="status" aria-live="polite" aria-busy="true">
    <p>Abriendo vista…</p>
    <div className="loading-line short" aria-hidden="true" />
    <div className="loading-line" aria-hidden="true" />
    <div className="loading-line" aria-hidden="true" />
  </section>;
}
