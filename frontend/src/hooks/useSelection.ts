import { useState, useCallback } from 'react';

/**
 * Hook to manage a Set of selected string IDs.
 */
export function useSelection(initial?: Iterable<string>) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);
  const count = selected.size;

  return { selected, toggle, clear, isSelected, count };
}
