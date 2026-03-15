'use client';

import { useEffect } from 'react';

/** Auto-opens the print dialog on mount; also renders the Print/Close buttons. */
export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="no-print flex gap-2">
      <button
        onClick={() => window.print()}
        className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900"
      >
        🖨️ Print
      </button>
      <button
        onClick={() => window.close()}
        className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
      >
        Close
      </button>
    </div>
  );
}
