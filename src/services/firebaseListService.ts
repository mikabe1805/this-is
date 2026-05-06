import { db } from '../firebase/config'
import {
  collection,
  addDoc,
  doc,
  setDoc,
  Timestamp,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore'
import { firebaseStorageService } from './firebaseStorageService'
import { readCoords } from '../utils/coords'
import type { List, ListPlace } from '../types'

class FirebaseListService {
  async createList(listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[], userId: string, coverImage?: File }): Promise<string | null> {
    try {
      const newListRef = doc(collection(db, 'lists'));
      const listId = newListRef.id;

      let coverImageUrl = '';
      if (listData.coverImage) {
        coverImageUrl = await firebaseStorageService.uploadListImage(listId, listData.coverImage);
      }

      const list = {
        id: listId,
        name: listData.name,
        description: listData.description,
        privacy: listData.privacy,
        isPublic: listData.privacy === 'public',
        tags: listData.tags,
        userId: listData.userId,
        coverImage: coverImageUrl,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        hubs: [],
        likes: 0,
        isLiked: false,
      };
      await setDoc(newListRef, list);

      // Log activity so the new list shows up in the creator's recent
      // activity feed. The mirror method in firebaseDataService.createList
      // also writes this — both call sites need parity.
      try {
        const activityRef = doc(collection(db, 'users', listData.userId, 'activity'));
        await setDoc(activityRef, {
          id: activityRef.id,
          type: 'create_list',
          userId: listData.userId,
          listId: listId,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Failed to log create_list activity:', e);
      }

      return newListRef.id;
    } catch (error) {
      console.error('Error creating list:', error);
      return null;
    }
  }

  async getList(listId: string): Promise<List | null> {
    try {
      const listRef = doc(db, 'lists', listId);
      const listSnap = await getDoc(listRef);
      if (listSnap.exists()) {
        return { id: listSnap.id, ...listSnap.data() } as List;
      }
      return null;
    } catch (error) {
      console.error('Error fetching list:', error);
      return null;
    }
  }

  async getPlacesForList(listId: string): Promise<ListPlace[]> {
    try {
      // First get the list document to check the hubs array
      const listRef = doc(db, 'lists', listId);
      const listSnap = await getDoc(listRef);
      if (!listSnap.exists()) {
        return [];
      }
      
      const listData = listSnap.data() as List;
      const hubIds = listData.hubs || [];
      
      // Get places from subcollection
      const placesQuery = query(collection(db, `lists/${listId}/places`));
      const placesSnapshot = await getDocs(placesQuery);
      const subcollectionPlaces = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListPlace));
      
      // Create a map of placeId to subcollection data
      const subcollectionMap = new Map();
      subcollectionPlaces.forEach(place => {
        subcollectionMap.set(place.placeId, place);
      });
      
      // For each hub ID, get the place data from the places collection
      const places: ListPlace[] = [];
      for (const rawHubId of hubIds) {
        // Defensive: legacy lists may have non-string entries here, or
        // hub objects (rather than ids). Coerce to string and skip blanks.
        const hubId = typeof rawHubId === 'string'
          ? rawHubId
          : (rawHubId && typeof rawHubId === 'object' && 'id' in (rawHubId as object))
            ? String((rawHubId as { id: string }).id)
            : ''
        if (!hubId) continue
        try {
          // Try to get place data from places collection first
          const placeRef = doc(db, 'places', hubId);
          const placeSnap = await getDoc(placeRef);
          
          if (placeSnap.exists()) {
            const placeData = placeSnap.data();
            const subcollectionData = subcollectionMap.get(hubId) || {};
            const coords = readCoords(placeData)

            places.push({
              id: hubId,
              placeId: hubId,
              place: {
                id: hubId,
                name: placeData.name || 'Unknown Place',
                address: placeData.location?.address || placeData.address || 'No address',
                tags: placeData.tags || [],
                // Carry through every field HubImage / map / poster need so
                // the list view can render the user-chosen cover, fall back
                // to the Google Places photo, then to the duotone poster.
                mainImage: placeData.mainImage || '',
                hubImage: placeData.mainImage || '',
                coverImage: placeData.coverImage || '',
                photos: Array.isArray(placeData.photos) ? placeData.photos : [],
                primaryType: placeData.primaryType || null,
                types: Array.isArray(placeData.types) ? placeData.types : [],
                coordinates: coords,
                posts: [],
                savedCount: placeData.savedCount || 0,
                createdAt: placeData.createdAt || ''
              } as any,
              status: subcollectionData.status || 'loved', // Include status from subcollection
              triedRating: subcollectionData.triedRating || null, // Include rating from subcollection
              addedBy: subcollectionData.addedBy || '',
              note: subcollectionData.note || '',
              addedAt: subcollectionData.addedAt || Timestamp.now()
            });
          } else {
            // If not found in places collection, try hubs collection
            try {
              const hubRef = doc(db, 'hubs', hubId);
              const hubSnap = await getDoc(hubRef);
              
              if (hubSnap.exists()) {
                const hubData = hubSnap.data();
                const subcollectionData = subcollectionMap.get(hubId) || {};
                const coords = readCoords(hubData)

                places.push({
                  id: hubId,
                  placeId: hubId,
                  place: {
                    id: hubId,
                    name: hubData.name || 'Unknown Place',
                    address: hubData.location?.address || hubData.address || 'No address',
                    tags: hubData.tags || [],
                    mainImage: hubData.mainImage || '',
                    hubImage: hubData.mainImage || '',
                    coverImage: hubData.coverImage || '',
                    photos: Array.isArray(hubData.photos) ? hubData.photos : [],
                    primaryType: hubData.primaryType || null,
                    types: Array.isArray(hubData.types) ? hubData.types : [],
                    coordinates: coords,
                    posts: [],
                    savedCount: hubData.savedCount || 0,
                    createdAt: hubData.createdAt || ''
                  } as any,
                  status: subcollectionData.status || 'loved', // Include status from subcollection
                  triedRating: subcollectionData.triedRating || null, // Include rating from subcollection
                  addedBy: subcollectionData.addedBy || '',
                  note: subcollectionData.note || '',
                  addedAt: subcollectionData.addedAt || Timestamp.now()
                });
              }
            } catch (hubError) {
              console.error(`Error fetching hub ${hubId}:`, hubError);
              // Continue with other places even if one fails
            }
          }
        } catch (error) {
          console.error(`Error fetching place ${hubId}:`, error);
          // Continue with other places even if one fails
        }
      }
      
      return places;
    } catch (error) {
      console.error('Error fetching places for list:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  async likeList(listId: string, userId: string): Promise<void> {
    const listRef = doc(db, 'lists', listId);
    const listSnap = await getDoc(listRef);
    if (!listSnap.exists()) return;
    const list = listSnap.data() as List;
    const alreadyLiked = (list.likedBy || []).includes(userId);
    // Atomic — see firebaseDataService.likePost.
    if (alreadyLiked) {
      await updateDoc(listRef, { likedBy: arrayRemove(userId), likes: increment(-1) });
    } else {
      await updateDoc(listRef, { likedBy: arrayUnion(userId), likes: increment(1) });
    }
  }

  async saveList(listId: string, userId: string): Promise<void> {
    const userSavedListRef = doc(db, `users/${userId}/savedLists`, listId);
    const savedListSnap = await getDoc(userSavedListRef);
    if (savedListSnap.exists()) {
      await deleteDoc(userSavedListRef);
    } else {
      await setDoc(userSavedListRef, { listId, savedAt: Timestamp.now() });
    }
  }

  async isListSaved(listId: string, userId: string): Promise<boolean> {
    const userSavedListRef = doc(db, `users/${userId}/savedLists`, listId);
    const savedListSnap = await getDoc(userSavedListRef);
    return savedListSnap.exists();
  }

  async savePlaceToList(placeId: string, listId: string, userId: string, note?: string, status?: 'loved' | 'tried' | 'want', triedRating?: 'liked' | 'neutral' | 'disliked'): Promise<void> {
    const listPlaceRef = doc(db, `lists/${listId}/places`, placeId);
    await setDoc(listPlaceRef, {
      placeId,
      addedBy: userId,
      status: status || 'loved', // Default to loved if no status provided
      triedRating: status === 'tried' ? (triedRating || 'liked') : null, // Only include rating for tried status
      addedAt: Timestamp.now(),
      note: note || ''
    });
  }

  /**
   * Update fields on an existing list-place entry (note, status, feeling/rating)
   * without clobbering addedBy/addedAt. Used by the Edit Place modal — was
   * previously not wired to anything, so user edits silently disappeared.
   */
  async updateListPlace(
    listId: string,
    placeId: string,
    updates: { note?: string; status?: 'loved' | 'tried' | 'want'; triedRating?: 'amazing' | 'good' | 'okay' | 'disappointing' | 'liked' | 'neutral' | 'disliked' | null }
  ): Promise<void> {
    const ref = doc(db, `lists/${listId}/places`, placeId);
    const patch: Record<string, unknown> = {};
    if (typeof updates.note === 'string') patch.note = updates.note;
    if (updates.status) patch.status = updates.status;
    // Clear rating when status leaves 'tried'.
    if (updates.status && updates.status !== 'tried') {
      patch.triedRating = null;
    } else if (updates.triedRating !== undefined) {
      patch.triedRating = updates.triedRating;
    }
    if (Object.keys(patch).length === 0) return;
    await updateDoc(ref, patch);
  }

  async removePlaceFromList(listId: string, placeId: string): Promise<void> {
    const listPlaceRef = doc(db, `lists/${listId}/places`, placeId);
    await deleteDoc(listPlaceRef);
    // Atomic remove from the parent list's hubs[] array. arrayRemove is a
    // server-side merge so this won't race with a concurrent savePlaceToList
    // on the same list.
    try {
      const listRef = doc(db, 'lists', listId);
      await updateDoc(listRef, { hubs: arrayRemove(placeId), updatedAt: Timestamp.now() });
    } catch (e) {
      console.warn('[removePlaceFromList] failed to sync parent hubs[]', e);
    }
  }

  async updateList(listId: string, data: Partial<List>): Promise<void> {
    const listRef = doc(db, 'lists', listId);
    const updatePayload: any = { ...data, updatedAt: Timestamp.now() };
    if (typeof (data as any).privacy === 'string') {
      updatePayload.isPublic = (data as any).privacy === 'public';
    }
    await updateDoc(listRef, updatePayload);
  }

  async deleteList(listId: string): Promise<void> {
    // Clean up subcollections before deleting the parent doc — Firestore does
    // NOT cascade. Without this, places/posts under the deleted list become
    // orphaned (still consume storage and can leak via direct queries).
    try {
      const subcollections = ['places', 'posts'];
      for (const sub of subcollections) {
        const subSnap = await getDocs(collection(db, `lists/${listId}/${sub}`));
        await Promise.all(subSnap.docs.map(d => deleteDoc(d.ref)));
      }
    } catch (e) {
      console.warn('[deleteList] subcollection cleanup failed', e);
    }
    const listRef = doc(db, 'lists', listId);
    await deleteDoc(listRef);
  }

  async getUserLists(userId: string): Promise<List[]> {
    try {
      const listsQuery = query(collection(db, 'lists'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const listsSnapshot = await getDocs(listsQuery);
      return listsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as List));
    } catch (error) {
      console.error('Error fetching user lists:', error);
      return [];
    }
  }
}

export const firebaseListService = new FirebaseListService()
