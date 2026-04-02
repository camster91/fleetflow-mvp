import { useState, useEffect } from 'react';

export function useRecentItems<T>(key: string, maxItems: number = 20) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) setItems(JSON.parse(stored));
  }, [key]);

  const addItem = (item: T) => {
    const updated = [item, ...items.filter(i => JSON.stringify(i) !== JSON.stringify(item))].slice(0, maxItems);
    setItems(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  return { items, addItem };
}
