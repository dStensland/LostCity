"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print emory-secondary-btn inline-flex items-center text-sm"
    >
      Print this page
    </button>
  );
}
