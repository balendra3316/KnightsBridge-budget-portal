'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-3.5 py-1.5 rounded-md border border-kb-border bg-kb-surface text-kb-fg-2 text-xs font-semibold cursor-pointer font-sans hover:bg-kb-surface-alt transition-colors duration-150"
    >
      Print / PDF
    </button>
  )
}
