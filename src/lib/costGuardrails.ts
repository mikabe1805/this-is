/**
 * Cost Guardrails - Prevent runaway Google Places API spending
 * Implements server-side daily ceilings and emergency kill switches
 */

import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const DAILY_CEILING_SEARCHES = 100; // Max searches per day across all users
const DAILY_CEILING_DETAILS = 50;   // Max detail calls per day
const DAILY_CEILING_PHOTOS = 50;    // Max photo loads per day

interface DailyStats {
  date: string;
  searchCount: number;
  detailsCount: number;
  photosCount: number;
  lastReset: number;
}

/**
 * Check if we've hit daily ceilings for Places API usage
 * Returns false if we should stop making API calls
 */
export async function checkDailyCeiling(type: 'search' | 'details' | 'photos'): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const statsRef = doc(db, 'stats', `api-${today}`);
    const statsSnap = await getDoc(statsRef);
    
    if (!statsSnap.exists()) {
      // First call today, initialize
      await setDoc(statsRef, {
        date: today,
        searchCount: 0,
        detailsCount: 0,
        photosCount: 0,
        lastReset: Date.now()
      });
      return true;
    }
    
    const stats = statsSnap.data() as DailyStats;
    
    // Check ceiling based on type
    switch (type) {
      case 'search':
        return stats.searchCount < DAILY_CEILING_SEARCHES;
      case 'details':
        return stats.detailsCount < DAILY_CEILING_DETAILS;
      case 'photos':
        return stats.photosCount < DAILY_CEILING_PHOTOS;
      default:
        return false;
    }
  } catch (error) {
    console.error('[Cost Guardrails] Check failed', error);
    // On error, allow the call (fail open)
    return true;
  }
}

/**
 * Increment counter for a specific API type
 */
export async function incrementApiCounter(type: 'search' | 'details' | 'photos'): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const statsRef = doc(db, 'stats', `api-${today}`);
    
    const fieldMap = {
      search: 'searchCount',
      details: 'detailsCount',
      photos: 'photosCount'
    };
    
    await updateDoc(statsRef, {
      [fieldMap[type]]: (await getDoc(statsRef)).data()?.[fieldMap[type]] + 1 || 1
    });
    
    console.log(`[Cost Guardrails] ${type} count incremented`);
  } catch (error) {
    console.warn('[Cost Guardrails] Increment failed', error);
  }
}

/**
 * Get current daily stats (for monitoring dashboard)
 */
export async function getDailyStats(): Promise<DailyStats | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const statsRef = doc(db, 'stats', `api-${today}`);
    const statsSnap = await getDoc(statsRef);
    
    if (!statsSnap.exists()) {
      return {
        date: today,
        searchCount: 0,
        detailsCount: 0,
        photosCount: 0,
        lastReset: Date.now()
      };
    }
    
    return statsSnap.data() as DailyStats;
  } catch (error) {
    console.error('[Cost Guardrails] Get stats failed', error);
    return null;
  }
}

/**
 * Check remote kill switch flag from Firestore
 * Allows emergency shutdown without redeploying
 */
export async function checkRemoteKillSwitch(): Promise<boolean> {
  try {
    const flagsRef = doc(db, 'config', 'flags');
    const flagsSnap = await getDoc(flagsRef);
    
    if (!flagsSnap.exists()) {
      return false; // No flags doc = no kill switch active
    }
    
    const flags = flagsSnap.data();
    return flags?.places_enabled === false || flags?.emergency_shutdown === true;
  } catch (error) {
    console.warn('[Cost Guardrails] Kill switch check failed', error);
    return false; // Fail open
  }
}

/**
 * Emergency: Activate remote kill switch
 * Run this in Firebase Console if costs spike unexpectedly
 */
export async function activateKillSwitch(): Promise<void> {
  try {
    const flagsRef = doc(db, 'config', 'flags');
    await setDoc(flagsRef, {
      places_enabled: false,
      emergency_shutdown: true,
      timestamp: Date.now(),
      reason: 'Cost spike detected'
    }, { merge: true });
    
    console.log('[Cost Guardrails] 🚨 Kill switch ACTIVATED');
  } catch (error) {
    console.error('[Cost Guardrails] Failed to activate kill switch', error);
  }
}

/**
 * Deactivate remote kill switch
 */
export async function deactivateKillSwitch(): Promise<void> {
  try {
    const flagsRef = doc(db, 'config', 'flags');
    await setDoc(flagsRef, {
      places_enabled: true,
      emergency_shutdown: false,
      timestamp: Date.now()
    }, { merge: true });
    
    console.log('[Cost Guardrails] ✅ Kill switch deactivated');
  } catch (error) {
    console.error('[Cost Guardrails] Failed to deactivate kill switch', error);
  }
}

