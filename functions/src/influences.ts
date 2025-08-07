import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const calculateInfluenceScores = onSchedule('every 24 hours', async (event) => {
    console.log('Calculating influence scores...');

    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        let influenceScore = 0;

        // Calculate influence from posts
        const postsSnapshot = await db.collection('posts').where('userId', '==', userId).get();
        postsSnapshot.forEach(postDoc => {
            const post = postDoc.data();
            influenceScore += (post.likes || 0) * 2; // Likes are worth 2 points
            influenceScore += (post.saves || 0) * 3; // Saves are worth 3 points
        });

        // Calculate influence from lists
        const listsSnapshot = await db.collection('lists').where('userId', '==', userId).get();
        listsSnapshot.forEach(listDoc => {
            const list = listDoc.data();
            influenceScore += (list.likes || 0) * 5; // List likes are worth 5 points
            influenceScore += (list.saves || 0) * 10; // List saves are worth 10 points
        });

        await db.collection('users').doc(userId).update({
            influences: influenceScore,
        });
    }

    console.log('Influence scores calculated successfully.');
});
