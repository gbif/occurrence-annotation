import { useCallback, useState } from 'react';

const PREFIX = 'overlayVisible:';

function readStored(name: string): boolean {
  try {
    return localStorage.getItem(PREFIX + name) !== 'false';
  } catch {
    return true;
  }
}

/** Visibility of a map overlay, remembered across visits and shared between map instances on load. */
export function useOverlayVisibility(name: string): [boolean, (visible: boolean) => void] {
  const [visible, setVisible] = useState(() => readStored(name));
  const update = useCallback((next: boolean) => {
    setVisible(next);
    try {
      localStorage.setItem(PREFIX + name, String(next));
    } catch (error) {
      console.warn('Could not save overlay preference:', error);
    }
  }, [name]);
  return [visible, update];
}
