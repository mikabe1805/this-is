/**
 * Photo Budget System
 * Limits Google Places photo fetches to a daily quota to control costs.
 * Each photo fetch costs ~$0.007, so 10/day = $0.07/day max.
 */

const DAILY_LIMIT = Number(import.meta.env.VITE_DAILY_GOOGLE_PHOTO_LIMIT ?? 10);
const KEY = 'photoBudget:v1';

interface BudgetState {
  date: string;
  used: number;
}

export function canFetchGooglePhoto(): boolean {
  if (DAILY_LIMIT === 0) return false;
  
  const today = new Date().toISOString().slice(0, 10);
  const state = getState();
  
  if (state.date !== today) {
    // New day, reset counter
    localStorage.setItem(KEY, JSON.stringify({ date: today, used: 0 }));
    return true;
  }
  
  return state.used < DAILY_LIMIT;
}

export function markGooglePhotoFetched() {
  const today = new Date().toISOString().slice(0, 10);
  const state = getState();
  const used = (state.date === today ? state.used : 0) + 1;
  
  localStorage.setItem(KEY, JSON.stringify({ date: today, used }));
  console.log(`[Photo Budget] ${used}/${DAILY_LIMIT} photos used today`);
}

export function getRemainingBudget(): number {
  const today = new Date().toISOString().slice(0, 10);
  const state = getState();
  
  if (state.date !== today) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - state.used);
}

function getState(): BudgetState {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{"date":"","used":0}');
  } catch {
    return { date: '', used: 0 };
  }
}

