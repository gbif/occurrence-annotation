import { Eye, EyeOff } from 'lucide-react';

interface OverlayToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  color: string;
  dashed?: boolean;
  title?: string;
}

/** Legend checkbox whose swatch matches the overlay it shows or hides. */
export function OverlayToggle({ checked, onChange, label, color, dashed, title }: OverlayToggleProps) {
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1 rounded focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
      style={{ pointerEvents: 'auto' }}
      title={title ? `${title}\n\n${checked ? 'Click to hide' : 'Click to show'} on map` : checked ? 'Hide on map' : 'Show on map'}
      onPointerDown={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      onClick={stop}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        aria-label={`Show ${label} on map`}
      />
      {checked
        ? <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        : <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />}
      <span
        aria-hidden="true"
        className="inline-block h-2 w-3 border"
        style={{
          borderColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
          backgroundColor: checked ? `${color}33` : 'transparent',
          opacity: checked ? 1 : 0.5,
        }}
      />
      <span className={checked ? '' : 'text-slate-400 line-through'}>{label}</span>
    </label>
  );
}
