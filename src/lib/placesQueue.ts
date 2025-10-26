/**
 * Request queue for Google Places API calls
 * Prevents rate limiting by serializing requests and implementing backoff
 */

type QueuedRequest<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class PlacesRequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private isProcessing = false;
  private consecutiveErrors = 0;
  private lastRequestTime = 0;
  private readonly MIN_GAP_MS = 500; // Minimum time between requests
  private readonly MAX_RETRIES = 2;

  async enqueue<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: requestFn,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      
      try {
        // Respect minimum gap between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_GAP_MS) {
          await this.sleep(this.MIN_GAP_MS - timeSinceLastRequest);
        }

        // Apply exponential backoff if we've had consecutive errors
        if (this.consecutiveErrors > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, this.consecutiveErrors - 1), 8000);
          console.log(`[PlacesQueue] Backing off ${backoffMs}ms due to ${this.consecutiveErrors} consecutive errors`);
          await this.sleep(backoffMs);
        }

        this.lastRequestTime = Date.now();
        const result = await request.execute();
        
        // Success - reset error counter
        this.consecutiveErrors = 0;
        request.resolve(result);

      } catch (error: any) {
        const errorMsg = String(error?.message || error || '');
        const is429 = errorMsg.includes('429') || /Too\s*Many/i.test(errorMsg);

        if (is429) {
          this.consecutiveErrors++;
          console.error(`[PlacesQueue] Rate limit hit (${this.consecutiveErrors}/${this.MAX_RETRIES})`);

          // Retry with exponential backoff
          if (this.consecutiveErrors <= this.MAX_RETRIES) {
            const backoffMs = 2000 * Math.pow(2, this.consecutiveErrors - 1);
            console.log(`[PlacesQueue] Retrying after ${backoffMs}ms backoff...`);
            await this.sleep(backoffMs);
            
            // Put request back at the front of queue
            this.queue.unshift(request);
            continue;
          }
        }

        // Max retries exceeded or other error
        console.error('[PlacesQueue] Request failed:', error);
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clear() {
    this.queue.forEach(req => req.reject(new Error('Queue cleared')));
    this.queue = [];
    this.consecutiveErrors = 0;
  }

  get queueSize() {
    return this.queue.length;
  }
}

export const placesQueue = new PlacesRequestQueue();

