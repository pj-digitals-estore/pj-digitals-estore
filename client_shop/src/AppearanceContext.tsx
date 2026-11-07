import { createContext, useContext, useState, type PropsWithChildren } from 'react';

const gradient = ['#3D2366', '#402A79', '#41318B', '#3C3899', '#3346A3', '#2953AC', '#205EB2'] as const;
const dark = {
  bg: '#171C32', surface: '#242B46', text: '#F4F5FF', muted: '#BAC3DF', primary: '#6951DD', primaryText: '#A9C2FF',
  soft: '#303452', tint: '#413B6A', border: '#625998', accent: '#C6A6FF', gold: '#C6A6FF', red: '#FFADAB',
  success: '#8AE0C3', successSurface: '#234451', warningSurface: '#483047', onPrimary: '#FFFFFF',
  glass: 'rgba(36,43,70,0.95)', glow: '0px 5px 20px rgba(142,108,255,0.12)', gradient,
  loadingGradient: ['#241D43', '#44307B', '#205EB2'] as const,
};
const light = {
  bg: '#F7F7FF', surface: '#FFFFFF', text: '#263252', muted: '#65718D', primary: '#6547D3', primaryText: '#315CB8',
  soft: '#EDEBFC', tint: '#E0DCFB', border: '#C6C5EF', accent: '#7048B7', gold: '#7048B7', red: '#B74658',
  success: '#186B55', successSurface: '#DDF4EB', warningSurface: '#FAE7EC', onPrimary: '#FFFFFF',
  glass: 'rgba(251,250,255,0.96)', glow: '0px 5px 20px rgba(98,80,160,0.10)', gradient,
  loadingGradient: ['#F0E7FF', '#D8D5FF', '#ABD9FF'] as const,
};
function aliases(colors: typeof dark | typeof light) {
  return { ...colors, panel: colors.surface, raised: colors.soft, line: colors.border, blue: colors.primary,
    cyan: colors.accent, green: colors.primaryText, amber: colors.accent };
}
export type ThemePalette = ReturnType<typeof aliases>;
export type ThemeMode = 'light' | 'dark';
const palettes = { dark: aliases(dark), light: aliases(light) };
const Context = createContext<{ mode: ThemeMode; colors: ThemePalette; setMode: (mode: ThemeMode) => void } | null>(null);
export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  return <Context.Provider value={{ mode, colors: palettes[mode], setMode }}>{children}</Context.Provider>;
}
export function useAppTheme() {
  const theme = useContext(Context);
  if (!theme) throw new Error('AppThemeProvider is required.');
  return theme;
}
