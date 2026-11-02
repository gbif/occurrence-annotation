import { useEffect, useSyncExternalStore } from 'react';

export interface OverlayEntry {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  status: 'loading' | 'error' | 'ready';
  detail?: string;
  description?: string;
  unmapped?: string[];
}

let entries: OverlayEntry[] = [];
const listeners = new Set<() => void>();

function emit(next: OverlayEntry[]) {
  entries = next;
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Entries currently published by map overlays, in registration order. */
export function useOverlayEntries(): OverlayEntry[] {
  return useSyncExternalStore(subscribe, () => entries);
}

/** Publishes an overlay to the shared map control; pass null to withdraw it. */
export function useOverlayEntry(entry: OverlayEntry | null) {
  const id = entry?.id;
  useEffect(() => {
    if (!entry) return;
    const index = entries.findIndex(item => item.id === entry.id);
    emit(index < 0 ? [...entries, entry] : entries.map((item, i) => (i === index ? entry : item)));
  });
  useEffect(() => {
    if (!id) return;
    return () => emit(entries.filter(item => item.id !== id));
  }, [id]);
}
