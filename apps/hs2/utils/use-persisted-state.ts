import { useEffect, useState } from 'react';

/**
 * useState that mirrors to localStorage under `key`. Safe to read in the
 * initializer here because the only consumer (MapView) is client-only
 * (next/dynamic ssr:false), so this never runs during SSR — no hydration
 * mismatch. A bad/absent stored value falls back to `initial`.
 */
export function usePersistedState<T>(
  key: string,
  initial: T
): [T, (v: T) => void] {
  const read = (): T => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  };

  const [value, setValue] = useState<T>(read);

  // If `key` changes, reload from the new slot before the write effect runs, so
  // we don't copy the previous key's value into the new one. React's
  // adjust-state-during-render pattern (tracked via state, not a ref).
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setValue(read());
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable (private mode / quota) — preference just won't persist */
    }
  }, [key, value]);

  return [value, setValue];
}
