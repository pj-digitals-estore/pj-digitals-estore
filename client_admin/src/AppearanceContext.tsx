import { createContext, useContext, useState, type PropsWithChildren } from 'react';

const gradient = ['#3D2366', '#402A79', '#41318B', '#3C3899', '#3346A3', '#2953AC', '#205EB2'] as const;
const dark = {
  bg: '#171C32', surface: '#242B46', text: '#F4F5FF', muted: '#BAC3DF', primary: '#6951DD', primaryText: '#A9C2FF',
  soft: '#303452', tint: '#413B6A', border: '#625998', accent: '#C6A6FF', gold: '#C6A6FF', red: '#FFADAB',
  success: '#8AE0C3', successSurface: '#234451', warningSurface: '#483047', onPrimary: '#FFFFFF',
  glass: 'rgba(36,43,70,0.95)', glow: '0px 5px 20px rgba(142,108,255,0.12)', gradient,
  loadingGradient: ['#241D43', '#44307B', '#205EB2'] as const,
  heroText: '#FFFFFF', heroMuted: '#DCE5FF', heroKicker: '#D7C9FF',
  heroButton: 'rgba(255,255,255,0.10)', heroButtonBorder: 'rgba(220,225,255,0.45)',
  heroSummary: 'rgba(18,25,54,0.25)', heroSummaryBorder: 'rgba(220,225,255,0.22)',
};
const light = {
  bg: '#F8FAFD', surface: '#FFFFFF', text: '#263252', muted: '#5D6982', primary: '#6547D3', primaryText: '#315CB8',
  soft: '#F0EEFC', tint: '#E9E5FA', border: '#DEE2EF', accent: '#7048B7', gold: '#7048B7', red: '#B74658',
  success: '#186B55', successSurface: '#DDF4EB', warningSurface: '#FAE7EC', onPrimary: '#FFFFFF',
  glass: 'rgba(255,255,255,0.96)', glow: '0px 5px 20px rgba(54,70,110,0.06)',
  gradient: ['#F1EBFF', '#EDEBFF', '#E8EDFF', '#E5F0FF', '#E6F4FF', '#EDF8FF', '#F5FAFF'] as const,
  loadingGradient: ['#F0E7FF', '#D8D5FF', '#ABD9FF'] as const,
  heroText: '#283453', heroMuted: '#4E5D7B', heroKicker: '#6547A0',
  heroButton: '#6547D3', heroButtonBorder: '#6547D3',
  heroSummary: 'rgba(255,255,255,0.78)', heroSummaryBorder: '#D5DFF1',
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
