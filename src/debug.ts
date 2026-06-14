if (import.meta.env.DEV) {
  console.log('%c🔧 DEBUG SYSTEM INITIALIZING', 'color: purple; font-weight: bold; font-size: 16px;');

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    originalLog(`[${new Date().toLocaleTimeString()}]`, ...args);
  };

  console.error = (...args) => {
    originalError(`%c[${new Date().toLocaleTimeString()}] ERROR`, 'color: red; font-weight: bold;', ...args);
  };

  console.warn = (...args) => {
    originalWarn(`%c[${new Date().toLocaleTimeString()}] WARN`, 'color: orange; font-weight: bold;', ...args);
  };

  window.addEventListener('error', (event) => {
    console.error('%c🔥 GLOBAL ERROR EVENT:', 'color: red; font-weight: bold; font-size: 14px;', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      stack: event.error?.stack
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('%c🔥 UNHANDLED PROMISE REJECTION:', 'color: red; font-weight: bold; font-size: 14px;', {
      reason: event.reason,
      promise: event.promise,
      stack: event.reason?.stack
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    console.log('%c✅ DOM CONTENT LOADED', 'color: green; font-weight: bold;');
  });

  console.log('%c✅ DEBUG SYSTEM READY', 'color: green; font-weight: bold; font-size: 16px;');
}
