/**
 * Coerce the various timestamp shapes the app stores (Firestore Timestamp, ISO
 * string, Unix seconds/ms, Date) into a Date, or null if unparseable.
 */
export const parseTimestamp = (timestamp: any): Date | null => {
  if (!timestamp) return null;

  let date: Date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return null;
  }

  return isNaN(date.getTime()) ? null : date;
};

export const formatTimestamp = (timestamp: any): string => {
  const date = parseTimestamp(timestamp);
  if (!date) return timestamp ? 'Invalid Date' : 'Date unknown';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Compact relative time for inbox / activity rows: "now", "5m", "3h", a weekday
 * within the last week, then "Jun 12" (and a year once it's a different year).
 * Deliberately terse so it sits quietly at the end of a list row.
 */
export const formatRelativeTime = (timestamp: any): string => {
  const date = parseTimestamp(timestamp);
  if (!date) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/**
 * Clock time for a chat bubble / message group header — "2:14 PM", prefixed
 * with Today / Yesterday / weekday / date when the conversation spans days.
 */
export const formatChatTime = (timestamp: any): string => {
  const date = parseTimestamp(timestamp);
  if (!date) return '';

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Yesterday ${time}`;
  if (dayDiff < 7) return `${date.toLocaleDateString('en-US', { weekday: 'long' })} ${time}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${day}, ${time}`;
};
