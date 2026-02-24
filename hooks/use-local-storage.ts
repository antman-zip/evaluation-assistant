"use client";

import { useEffect, useMemo, useState } from "react";

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        setState(JSON.parse(raw) as T);
      }
    } catch (error) {
      console.error(`Failed to restore localStorage key: ${key}`, error);
    } finally {
      setIsHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Failed to save localStorage key: ${key}`, error);
    }
  }, [key, state, isHydrated]);

  const clear = useMemo(
    () => () => {
      setState(initialValue);
      window.localStorage.removeItem(key);
    },
    [initialValue, key]
  );

  return { state, setState, isHydrated, clear };
}
