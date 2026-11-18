// Debounce utility for progress callbacks and resize events

export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;

  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

// Quick debounce for specific use cases

export const progressDebounce = debounce((callback: (p: any) => void, progress: any) => {
  callback(progress);
}, 200);

// Throttle utility - ensures func is called at most once per wait period

export function throttle<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;
  let args: Parameters<T> | null = null;
  let lastRan = Date.now();

  const handler = (...args: Parameters<T>) => {
    args = args;
    if (timeout !== null) return;
    const delta = Date.now() - lastRan;
    if (delta >= wait) {
      lastRan = Date.now();
      func(...args);
    } else {
      timeout = setTimeout(() => {
        lastRan = Date.now();
        func(...args);
        timeout = null;
      }, wait - delta);
    }
  };

  return ((...args: Parameters<T>) => {
    handler(...args);
  }) as T;
}
