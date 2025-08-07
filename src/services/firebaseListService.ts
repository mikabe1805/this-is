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
  orderBy
} from 'firebase/firestore'
import { firebaseStorageService } from './firebaseStorageService'
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
      for (const hubId of hubIds) {
        try {
          // Try to get place data from places collection first
          const placeRef = doc(db, 'places', hubId);
          const placeSnap = await getDoc(placeRef);
          
          if (placeSnap.exists()) {
            const placeData = placeSnap.data();
            const subcollectionData = subcollectionMap.get(hubId) || {};
            
            places.push({
              id: hubId,
              placeId: hubId,
              place: {
                id: hubId,
                name: placeData.name || 'Unknown Place',
                address: placeData.location?.address || 'No address',
                tags: placeData.tags || [],
                hubImage: placeData.mainImage || '',
                location: placeData.location || { lat: 0, lng: 0, address: '' }
              },
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
                
                places.push({
                  id: hubId,
                  placeId: hubId,
                  place: {
                    id: hubId,
                    name: hubData.name || 'Unknown Place',
                    address: hubData.location?.address || 'No address',
                    tags: hubData.tags || [],
                    hubImage: hubData.mainImage || '',
                    location: hubData.location || { lat: 0, lng: 0, address: '' }
                  },
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
    if (listSnap.exists()) {
      const list = listSnap.data() as List;
      const likedBy = list.likedBy || [];
      if (likedBy.includes(userId)) {
        await updateDoc(listRef, {
          likes: (list.likes || 1) - 1,
          likedBy: likedBy.filter(id => id !== userId)
        });
      } else {
        await updateDoc(listRef, {
          likes: (list.likes || 0) + 1,
          likedBy: [...likedBy, userId]
        });
      }
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

  async removePlaceFromList(listId: string, placeId: string): Promise<void> {
    const listPlaceRef = doc(db, `lists/${listId}/places`, placeId);
    await deleteDoc(listPlaceRef);
  }

  async updateList(listId: string, data: Partial<List>): Promise<void> {
    const listRef = doc(db, 'lists', listId);
    await updateDoc(listRef, { ...data, updatedAt: Timestamp.now() });
  }

  async deleteList(listId: string): Promise<void> {
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
