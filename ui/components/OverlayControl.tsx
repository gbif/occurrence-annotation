import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { OverlayToggle } from './OverlayToggle';
import { useOverlayEntries } from '../utils/overlayRegistry';

/** Collapsed "Layers" button that opens a panel to show/hide the map's informational overlays. */
export function OverlayControl() {
  const entries = useOverlayEntries();
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !controlRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const shown = sorted.filter(entry => entry.visible).length;
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 50 }}>
      <div
        ref={controlRef}
        className="absolute bottom-10 right-2 flex flex-col items-end gap-1"
        style={{ pointerEvents: 'auto', maxWidth: 'calc(100% - 5rem)', cursor: 'auto' }}
        onPointerDown={stop}
        onMouseDown={stop}
        onTouchStart={stop}
        onClick={stop}
        onDoubleClick={stop}
        onWheel={stop}
      >
        {open && (
          <div
            id="map-overlay-panel"
            role="group"
            aria-label="Map overlays"
            className="w-64 max-w-full space-y-2 rounded bg-white/95 p-2 text-xs text-slate-600 shadow"
          >
            {sorted.map(entry => (
              <div key={entry.id} title={entry.description}>
                {entry.status === 'ready' ? (
                  <OverlayToggle
                    checked={entry.visible}
                    onChange={entry.setVisible}
                    color={entry.color}
                    dashed={entry.dashed}
                    title={entry.description}
                    label={entry.label}
                  />
                ) : (
                  <span>{entry.status === 'loading' ? `Loading ${entry.label}...` : entry.detail}</span>
                )}
                {entry.status === 'ready' && entry.detail && (
                  <span className="block pl-4 text-slate-500">{entry.detail}</span>
                )}
                {entry.status === 'ready' && entry.unmapped && entry.unmapped.length > 0 && (
                  <details className="pl-4">
                    <summary className="cursor-pointer underline underline-offset-2">
                      {entry.unmapped.length} {entry.unmapped.length === 1 ? 'area' : 'areas'} not shown
                    </summary>
                    <p className="mt-1 text-slate-500">
                      Listed by COL without a geographic identifier, or the boundary could not be loaded.
                    </p>
                    <ul
                      className="mt-1 max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto overscroll-contain break-words"
                      tabIndex={0}
                      aria-label="Areas not shown"
                    >
                      {entry.unmapped.map(name => <li key={name}>{name}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-expanded={open}
          aria-controls="map-overlay-panel"
          title="Informative map layers for this taxon: click to choose which are shown"
          onClick={() => setOpen(value => !value)}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Overlays ({shown}/{sorted.length})
        </button>
      </div>
    </div>
  );
}
