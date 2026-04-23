// ===========================================
// Theme Store
// ===========================================

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getSafeStorage } from '@/lib/storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

const applyTheme = (resolvedTheme: 'light' | 'dark') => {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: getSystemTheme(),

      setTheme: (theme: Theme) => {
        const resolvedTheme = resolveTheme(theme);
        applyTheme(resolvedTheme);
        set({ theme, resolvedTheme });
      },

      toggleTheme: () => {
        const current = get().resolvedTheme;
        const newTheme = current === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        set({ theme: newTheme, resolvedTheme: newTheme });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => getSafeStorage()),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolvedTheme = resolveTheme(state.theme);
          applyTheme(resolvedTheme);
          state.resolvedTheme = resolvedTheme;
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      const resolvedTheme = e.matches ? 'dark' : 'light';
      applyTheme(resolvedTheme);
      useThemeStore.setState({ resolvedTheme });
    }
  });
}
