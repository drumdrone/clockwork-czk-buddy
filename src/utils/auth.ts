export const cleanupAuthState = () => {
  try {
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');

    // Remove all Supabase auth-related keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });

    // Remove from sessionStorage if present
    try {
      Object.keys(sessionStorage || {}).forEach((key) => {
        // @ts-ignore - sessionStorage may not be iterable in some environments
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
};
