import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { palettes, type Palette } from './data/catalog';

type ThemeMode = 'light' | 'dark';
const ThemeContext = createContext<{ mode: ThemeMode; palette: Palette; setMode: (mode: ThemeMode) => void }>({ mode: 'dark', palette: palettes.dark, setMode: () => {} });

export function StoreThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  return <ThemeContext.Provider value={{ mode, palette: palettes[mode], setMode }}>{children}</ThemeContext.Provider>;
}

export const useStoreTheme = () => useContext(ThemeContext);
