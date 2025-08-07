import { db } from '../firebase/config'
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp
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

      // If the post is associated with lists, update those lists
      if (postData.listIds && postData.listIds.length > 0) {
        console.log(`📝 Adding post to ${postData.listIds.length} lists:`, postData.listIds);
        for (const listId of postData.listIds) {
          try {
            await this.savePostToList(postId, listId);
            console.log(`✅ Post ${postId} added to list ${listId}`);
          } catch (error) {
            console.error(`❌ Failed to add post ${postId} to list ${listId}:`, error);
          }
        }
      }
      
      return postId;
    } catch (error) {
      console.error('Error creating post:', error);
      return null;
    }
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
      console.log(`🔍 Checking if list ${listId} exists...`);
      const listDoc = await getDoc(listRef);
      if (!listDoc.exists()) {
        throw new Error(`List with id ${listId} does not exist.`);
      }

      console.log(`📋 List ${listId} found, adding post ${postId}...`);

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

      console.log(`✅ Post ${postId} successfully saved to list ${listId}`);
    } catch (error) {
      console.error(`❌ Error saving post ${postId} to list ${listId}:`, error);
      throw error; // Re-throw so the calling function can handle it
    }
  }
async likePost(postId: string, userId: string): Promise<void> {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const post = postSnap.data() as Post;
      const likedBy = post.likedBy || [];
      if (likedBy.includes(userId)) {
        await updateDoc(postRef, {
          likes: (post.likes || 1) - 1,
          likedBy: likedBy.filter(id => id !== userId)
        });
      } else {
        await updateDoc(postRef, {
          likes: (post.likes || 0) + 1,
          likedBy: [...likedBy, userId]
        });
      }
    }
  }
}

export const firebasePostService = new FirebasePostService()
