let audioEl: HTMLAudioElement | null = null;
let unlocked = false;
let pendingBeeps = 0;
let soundsEnabled = true;

// Lazy load preference once (can be refreshed manually if needed)
function loadPref() {
  try {
    const uid = localStorage.getItem('current_user_id');
    if (!uid) return;
    const raw = localStorage.getItem('user_preferences_' + uid);
    if (raw) {
      const obj = JSON.parse(raw);
      if (typeof obj.enable_sounds === 'boolean') soundsEnabled = obj.enable_sounds; else soundsEnabled = true;
    }
  } catch { soundsEnabled = true; }
}
// Prime on module import
try { loadPref(); } catch {}

export function refreshSoundPreference() { loadPref(); }

function ensureAudio(): HTMLAudioElement | null {
  try {
    if (!audioEl) {
      audioEl = new Audio('/audio/notification.mp3');
      audioEl.preload = 'auto';
      // Enable inline playback on iOS Safari
      try { (audioEl as any).playsInline = true; } catch {}
      audioEl.setAttribute('playsinline', 'true');
      audioEl.volume = 1.0;
    }
    return audioEl;
  } catch {
    return null;
  }
}

export function playNotificationSound(): void {
  if (!soundsEnabled) return;
  const el = ensureAudio();
  if (!el) return;
  try {
    // Restart from beginning if already playing
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.catch(() => {
        // Likely blocked by autoplay policy — queue and rely on unlock
        pendingBeeps = Math.min(pendingBeeps + 1, 3);
      });
    }
  } catch {
    // no-op
  }
}

function unlockOnce() {
  if (unlocked) return;
  const el = ensureAudio();
  if (!el) return;
  try {
    el.muted = true;
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        try { el.pause(); } catch {}
        el.currentTime = 0;
        el.muted = false;
        unlocked = true;
        // Flush any queued beeps
        const n = pendingBeeps; pendingBeeps = 0;
        for (let i = 0; i < n; i++) { try { playNotificationSound(); } catch {} }
      }).catch(() => {
        // Keep listeners for a later gesture
      });
    } else {
      // Older browsers that don't return a promise
      try { el.pause(); } catch {}
      el.currentTime = 0;
      el.muted = false;
      unlocked = true;
    }
  } catch {
    // swallow
  }
}

export function initNotificationSound(): void {
  if (typeof window === 'undefined') return;
  const tryUnlock = () => unlockOnce();
  const remove = () => {
    try { window.removeEventListener('pointerdown', tryUnlock); } catch {}
    try { window.removeEventListener('touchstart', tryUnlock); } catch {}
    try { window.removeEventListener('click', tryUnlock); } catch {}
    try { window.removeEventListener('keydown', tryUnlock); } catch {}
    try { document.removeEventListener('visibilitychange', tryUnlock); } catch {}
  };
  const wrap = () => { tryUnlock(); if (unlocked) remove(); };
  try { window.addEventListener('pointerdown', wrap, { once: false, passive: true } as any); } catch { window.addEventListener('pointerdown', wrap as any); }
  try { window.addEventListener('touchstart', wrap, { once: false, passive: true } as any); } catch { window.addEventListener('touchstart', wrap as any); }
  try { window.addEventListener('click', wrap, { once: false } as any); } catch { window.addEventListener('click', wrap as any); }
  try { window.addEventListener('keydown', wrap, { once: false } as any); } catch { window.addEventListener('keydown', wrap as any); }
  // If page becomes visible after background load, try unlock on first gesture
  try { document.addEventListener('visibilitychange', wrap, { once: false } as any); } catch { document.addEventListener('visibilitychange', wrap as any); }
}
