/**
 * Utility to diagnose and fix localStorage/cache issues
 */

export function clearAllAppData() {
  try {
    // Clear localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    console.log('✅ All app data cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear app data:', error);
    return false;
  }
}

export function diagnoseSupabaseConnection() {
  const issues = [];
  
  // Check environment variables
  const hasUrl = Boolean(import.meta.env.VITE_SUPABASE_URL);
  const hasKey = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  
  if (!hasUrl) issues.push('Missing VITE_SUPABASE_URL');
  if (!hasKey) issues.push('Missing VITE_SUPABASE_ANON_KEY');
  
  // Check localStorage size
  try {
    const size = JSON.stringify(localStorage).length;
    if (size > 5 * 1024 * 1024) { // 5MB
      issues.push('localStorage is large (>5MB), may cause issues');
    }
  } catch {
    issues.push('Cannot access localStorage');
  }
  
  return {
    healthy: issues.length === 0,
    issues,
    recommendations: issues.length > 0 
      ? ['Clear browser cache', 'Check Supabase project status', 'Verify environment variables']
      : []
  };
}

export function getSupabaseHealthStatus(): 'unknown' | 'healthy' | 'degraded' | 'down' {
  // Check if recent errors in console
  const recentErrors = performance.getEntriesByType('resource')
    .filter((entry: any) => entry.name.includes('supabase.co'))
    .slice(-10);
  
  if (recentErrors.length === 0) return 'unknown';
  
  const failedRequests = recentErrors.filter((entry: any) => 
    entry.transferSize === 0 || entry.duration === 0
  );
  
  const failureRate = failedRequests.length / recentErrors.length;
  
  if (failureRate === 0) return 'healthy';
  if (failureRate < 0.5) return 'degraded';
  return 'down';
}

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).supabaseDebug = {
    clearAllAppData,
    diagnoseSupabaseConnection,
    getSupabaseHealthStatus,
  };
}
