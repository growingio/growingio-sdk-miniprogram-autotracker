import { niceTry } from './tools';

/** One native request attempt owns its deadline, cancellation and late callbacks. */
export const createRequestAttempt = (timeout: number, onTimeout: () => void) => {
  let settled = false;
  let cancelled = false;
  let task: any;
  const abort = () => niceTry(() => task?.abort?.());
  const finish = () => {
    if (settled) return false;
    settled = true;
    clearTimeout(timer);
    return true;
  };
  const timer = setTimeout(() => {
    if (!finish()) return;
    cancelled = true;
    try {
      onTimeout();
    } finally {
      abort();
    }
  }, timeout);
  return {
    finish,
    cancel: () => {
      if (!finish()) return;
      cancelled = true;
      abort();
    },
    setTask: (requestTask: any) => {
      task = requestTask;
      if (cancelled) abort();
    }
  };
};
