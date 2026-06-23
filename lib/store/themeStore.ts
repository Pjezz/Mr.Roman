import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  toggle: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}))