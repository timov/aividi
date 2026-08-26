/**
 * Shown while a list page resolves. Mirrors the real layout so the page does
 * not jump when the content lands — a spinner in the middle of the viewport
 * tells you nothing and moves everything.
 */
export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <div className="skeleton skeleton-line" style={{ width: '30%', height: 12 }} />
      <div className="skeleton" style={{ width: '58%', height: 44, marginBottom: 18 }} />
      <div className="skeleton skeleton-line" style={{ width: '76%' }} />
      <div className="skeleton skeleton-line" style={{ width: '64%', marginBottom: 30 }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  )
}
