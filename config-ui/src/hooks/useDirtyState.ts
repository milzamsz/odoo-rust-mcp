import { useContext, useEffect } from 'react';
import { DirtyStateContext } from '../components/dirty-state-context';

export function useDirtyState() {
  const context = useContext(DirtyStateContext);
  if (!context) {
    return {
      activeMessage: null,
      isDirty: false,
      setDirty: () => {},
      clearAll: () => {},
    };
  }
  return context;
}

export function useRegisterDirtyState(id: string, dirty: boolean, message?: string) {
  const { setDirty } = useDirtyState();

  useEffect(() => {
    setDirty(id, dirty, message);
    return () => setDirty(id, false);
  }, [dirty, id, message, setDirty]);
}
