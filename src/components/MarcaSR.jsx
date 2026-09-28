// R7: la marca de hierro "SR" de la finca. Trazos gruesos de punta redonda, como deja el hierro
// en el cuero; el mismo dibujo está en public/favicon.svg.
export default function MarcaSR({ className = 'size-9', titulo = 'Finca Santa Rita' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label={titulo} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12.5c-1.6-1.9-4-3-6.6-3-4 0-6.9 2.3-6.9 5.6 0 7.4 13.9 5 13.9 13 0 3.6-3.1 6.2-7.3 6.2-3 0-5.5-1.2-7.1-3.3" />
      <path d="M27 34.5V10h7.2c4.3 0 7.3 2.7 7.3 6.4 0 3.8-3 6.4-7.3 6.4H27m7.4 0 7.6 11.7" />
      <path d="M6 41.5h36" />
    </svg>
  );
}
