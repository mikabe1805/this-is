export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) {
    return 'Date unknown';
  }

  let date: Date;

  // Handle Firebase Timestamp objects
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } 
  // Handle ISO strings or other date strings
  else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } 
  // Handle Unix timestamps (in seconds or milliseconds)
  else if (typeof timestamp === 'number') {
    // Check if it's in seconds (and convert to milliseconds)
    if (timestamp < 10000000000) { 
      date = new Date(timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
  }
  // Handle native Date objects
  else if (timestamp instanceof Date) {
    date = timestamp;
  }
  else {
    return 'Date invalid';
  }

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
