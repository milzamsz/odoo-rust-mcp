import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DirtyStateContext, type DirtyStateContextValue } from './dirty-state-context';

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, string>>({});

  const setDirty = useCallback((id: string, dirty: boolean, message = 'You have unsaved changes.') => {
    setEntries((current) => {
      if (dirty) {
        if (current[id] === message) {
          return current;
        }
        return { ...current, [id]: message };
      }

      if (!(id in current)) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setEntries({}), []);

  const value = useMemo<DirtyStateContextValue>(() => {
    const messages = Object.values(entries);
    return {
      activeMessage: messages[0] ?? null,
      isDirty: messages.length > 0,
      setDirty,
      clearAll,
    };
  }, [clearAll, entries, setDirty]);

  useEffect(() => {
    if (!value.isDirty) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [value.isDirty]);

  return <DirtyStateContext.Provider value={value}>{children}</DirtyStateContext.Provider>;
}
