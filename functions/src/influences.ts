import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const calculateInfluenceScores = onSchedule('every 24 hours', async (event) => {
    console.log('Calculating influence scores...');

    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        let influenceScore = 0;

        // Posts: likes count from each post the user authored. The legacy
        // `post.saves` term is dropped — that field is never written by the
        // app (saved-posts live in `users/{uid}/savedPosts/{postId}` and
        // aren't denormalized back onto the post doc).
        const postsSnapshot = await db.collection('posts').where('userId', '==', userId).get();
        postsSnapshot.forEach(postDoc => {
            const post = postDoc.data();
            influenceScore += (post.likes || 0) * 2;
        });

        // Lists: separate `likes` (heart) from `saves` (bookmark). These used
        // to share `list.likes`, so every save inflated the influence by 5+10.
        const listsSnapshot = await db.collection('lists').where('userId', '==', userId).get();
        listsSnapshot.forEach(listDoc => {
            const list = listDoc.data();
            influenceScore += (list.likes || 0) * 5;
            influenceScore += (list.saves || 0) * 10;
        });

        await db.collection('users').doc(userId).update({
            influences: influenceScore,
        });
    }

    console.log('Influence scores calculated successfully.');
});
