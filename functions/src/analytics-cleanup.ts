import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const scheduledanalyticscleanup = onSchedule('every 24 hours', async (event) => {
  console.log('Running daily analytics cleanup...');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldAnalyticsQuery = db.collection('analytics')
    .where('timestamp', '<=', thirtyDaysAgo);

  const snapshot = await oldAnalyticsQuery.get();

  if (snapshot.empty) {
    console.log('No old analytics documents to delete.');
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  console.log(`Deleted ${snapshot.size} old analytics documents.`);
});
