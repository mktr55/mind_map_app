/**
 * Creates a debounced function that delays invoking `func` until after
 * `wait` ms have elapsed since the last call. Optionally forces invocation
 * after `maxWait` ms even if the debounce timer keeps resetting.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to delay
 * @param {number} [maxWait] - Maximum wait before forced invocation
 * @returns {{ execute: Function, cancel: Function, flush: Function }}
 */
export function debounce(func, wait, maxWait) {
  let timeoutId  = null;
  let maxTimeout = null;
  let lastArgs   = null;

  function invoke() {
    const args = lastArgs;
    lastArgs   = null;
    clearTimeout(timeoutId);
    clearTimeout(maxTimeout);
    timeoutId  = null;
    maxTimeout = null;
    if (args) func(...args);
  }

  function execute(...args) {
    lastArgs = args;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(invoke, wait);
    if (maxWait && !maxTimeout) {
      maxTimeout = setTimeout(invoke, maxWait);
    }
  }

  function cancel() {
    clearTimeout(timeoutId);
    clearTimeout(maxTimeout);
    timeoutId  = null;
    maxTimeout = null;
    lastArgs   = null;
  }

  function flush() {
    if (lastArgs) invoke();
  }

  return { execute, cancel, flush };
}
