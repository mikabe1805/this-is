import { db } from '../firebase/config'
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  getDocs
} from 'firebase/firestore'
import { firebaseStorageService } from './firebaseStorageService'
import type { Post, List } from '../types'

class FirebasePostService {
  async createPost(postData: Omit<Post, 'id' | 'createdAt' | 'images'> & { images: File[] }): Promise<string | null> {
    try {
      const newPostRef = doc(collection(db, 'posts'));
      const postId = newPostRef.id;

      const imageUrls = await firebaseStorageService.uploadPostImages(postId, postData.images);

      const finalPostData: Post = {
        ...postData,
        id: postId,
        images: imageUrls,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        commentCount: 0,
      };

      await setDoc(newPostRef, finalPostData);

      // Save to all selected lists in one writeBatch — was a sequential loop
      // where a mid-flight failure left the post in some lists but not others
      // and the parent post's `listId` field was overwritten by each
      // iteration (so a post saved to [A, B, C] ended up with listId=C and
      // didn't appear in A's or B's getPostsForList query).
      if (postData.listIds && postData.listIds.length > 0) {
        try {
          await this.attachPostToLists(postId, postData.listIds);
        } catch (error) {
          console.error(`❌ Failed to attach post ${postId} to lists:`, error);
        }
      }

      // Log activity for the friends feed. The mirror method
      // `firebaseDataService.createPost` does this, but the UI's CreatePost
      // modal calls THIS one, so without this line new posts never showed
      // up in friends' "Recent Activity" surfaces.
      try {
        const activityRef = doc(collection(db, 'users', postData.userId, 'activity'));
        await setDoc(activityRef, {
          id: activityRef.id,
          type: 'post',
          userId: postData.userId,
          postId,
          placeId: (postData as { hubId?: string }).hubId,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[createPost] activity log failed', e);
      }

      return postId;
    } catch (error) {
      console.error('Error creating post:', error);
      return null;
    }
  }

  /**
   * Atomically attach a post to one or more lists. Each list gets a doc in
   * its `posts` subcollection; the post itself stores a `listIds[]` array
   * (canonical) plus a `listId` (legacy compat — first list).
   */
  async attachPostToLists(postId: string, listIds: string[]): Promise<void> {
    if (!Array.isArray(listIds) || listIds.length === 0) return;
    const batch = writeBatch(db);
    const ts = Timestamp.now();
    for (const listId of listIds) {
      const listPostRef = doc(db, 'lists', listId, 'posts', postId);
      batch.set(listPostRef, { postId, addedAt: ts });
    }
    const postRef = doc(db, 'posts', postId);
    batch.update(postRef, {
      listIds: arrayUnion(...listIds),
      listId: listIds[0],
    });
    await batch.commit();
  }

  async createEmbedPost(embedData: any, userId: string): Promise<string | null> {
    try {
      const newPostRef = doc(collection(db, 'posts'));
      const postId = newPostRef.id;

      const finalPostData: Post = {
        ...embedData,
        id: postId,
        userId,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        commentCount: 0,
      };

      await setDoc(newPostRef, finalPostData);

      // If the post is associated with lists, update those lists
      if (embedData.listIds && embedData.listIds.length > 0) {
        for (const listId of embedData.listIds) {
          await this.savePostToList(postId, listId);
        }
      }
      
      return postId;
    } catch (error) {
      console.error('Error creating embed post:', error);
      return null;
    }
  }

  async savePostToList(postId: string, listId: string): Promise<void> {
    const listRef = doc(db, 'lists', listId);
    const postRef = doc(db, 'posts', postId);

    try {
      const listDoc = await getDoc(listRef);
      if (!listDoc.exists()) {
        throw new Error(`List with id ${listId} does not exist.`);
      }


      // Add post to the list's posts subcollection
      const listPostsRef = collection(listRef, 'posts');
      await setDoc(doc(listPostsRef, postId), { 
        postId: postId,
        addedAt: Timestamp.now()
      });

      // Also update the post document to link back to the list
      await updateDoc(postRef, {
        listId: listId
      });

    } catch (error) {
      console.error(`❌ Error saving post ${postId} to list ${listId}:`, error);
      throw error; // Re-throw so the calling function can handle it
    }
  }
async likePost(postId: string, userId: string): Promise<void> {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const post = postSnap.data() as Post;
    const alreadyLiked = (post.likedBy || []).includes(userId);
    // Atomic — see firebaseDataService.likePost.
    if (alreadyLiked) {
      await updateDoc(postRef, { likedBy: arrayRemove(userId), likes: increment(-1) });
    } else {
      await updateDoc(postRef, { likedBy: arrayUnion(userId), likes: increment(1) });
    }
  }
}

export const firebasePostService = new FirebasePostService()
