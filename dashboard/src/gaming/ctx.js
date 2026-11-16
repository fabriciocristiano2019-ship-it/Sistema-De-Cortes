import { createContext } from 'react';

// Set by the Sede shell around a module: the numbered title the panel shows
// for it and the way back to the virtual room.
export const ModuleCtx = createContext(null);
