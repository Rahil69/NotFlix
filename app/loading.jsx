export default function Loading() {
  return (
    <main className="app-shell" aria-busy="true" aria-label="Loading FlixNotMV">
      <header className="site-header loading-header"><span className="loading-brand" /><span className="loading-search" /></header>
      <section className="catalog-section loading-catalog">
        <span className="loading-title" />
        <div className="poster-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div className="poster-skeleton" key={index}><div /><i /><i /></div>)}
        </div>
      </section>
    </main>
  );
}
