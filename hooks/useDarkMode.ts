import { useState, useEffect, useCallback } from 'react';

export function useDarkMode(): [boolean, () => void, (dark: boolean) => void] {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setDark = useCallback((dark: boolean) => {
    setIsDark(dark);
    localStorage.setItem('darkMode', String(dark));
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDark = useCallback(() => {
    setDark(!isDark);
  }, [isDark, setDark]);

  return [isDark, toggleDark, setDark];
}
