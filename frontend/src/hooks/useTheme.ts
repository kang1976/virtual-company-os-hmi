// frontend/src/hooks/useTheme.ts
import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'cyber-dark' | 'oled-black' | 'modern-light';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  iconName: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'cyber-dark',
    label: '사이버 다크',
    iconName: 'Moon',
    description: '기본 하이테크 슬레이트 블루 테마',
  },
  {
    id: 'oled-black',
    label: 'OLED 제트블랙',
    iconName: 'Sparkles',
    description: '배터리 절약 및 딥블랙 고대비 테마',
  },
  {
    id: 'modern-light',
    label: '모던 라이트',
    iconName: 'Sun',
    description: '주간 시인성 우수 클린 화이트 테마',
  },
];

const THEME_STORAGE_KEY = 'virtual_company_theme';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      if (saved && ['cyber-dark', 'oled-black', 'modern-light'].includes(saved)) {
        return saved;
      }
    } catch {
      // localStorage 불가 시 기본값
    }
    return 'cyber-dark';
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return !!(typeof document !== 'undefined' && document.fullscreenElement);
  });

  // 테마 변경 적용
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // 무시
    }
  }, []);

  // 테마 순환 토글
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode =
        prev === 'cyber-dark'
          ? 'oled-black'
          : prev === 'oled-black'
          ? 'modern-light'
          : 'cyber-dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // 무시
      }
      return next;
    });
  }, []);

  // 전체화면 토글
  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;

    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('[useTheme] Fullscreen 전환 실패:', err);
    }
  }, []);

  // 전체화면 상태 변경 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // DOM 속성 및 클래스 주입
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    if (theme === 'modern-light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }

    if (theme === 'oled-black') {
      root.classList.add('theme-oled');
    } else {
      root.classList.remove('theme-oled');
    }
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isFullscreen,
    toggleFullscreen,
    options: THEME_OPTIONS,
  };
}
