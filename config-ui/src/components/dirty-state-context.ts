import { createContext } from 'react';

export interface DirtyStateContextValue {
  activeMessage: string | null;
  isDirty: boolean;
  setDirty: (id: string, dirty: boolean, message?: string) => void;
  clearAll: () => void;
}

export const DirtyStateContext = createContext<DirtyStateContextValue | null>(null);
