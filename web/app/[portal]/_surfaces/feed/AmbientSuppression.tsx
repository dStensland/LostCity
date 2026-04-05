export function AmbientSuppression() {
  return (
    <style>{`
      body::before { opacity: 0 !important; }
      body::after { opacity: 0 !important; }
      .ambient-glow { opacity: 0 !important; }
      .rain-overlay { display: none !important; }
      .cursor-glow { display: none !important; }
    `}</style>
  );
}
