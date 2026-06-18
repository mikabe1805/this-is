import OpenAI from 'openai';

class AISearchService {
  private openai: OpenAI;
  private apiKey: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || null;
    // Browser-side OpenAI ships the key in the client bundle (extractable) and
    // bills an LLM call per search, so it must be EXPLICITLY opted into — a
    // stray VITE_OPENAI_API_KEY alone no longer silently enables it. For
    // production, proxy through a Cloud Function that holds the key server-side.
    const allowBrowser = import.meta.env.VITE_OPENAI_ALLOW_BROWSER === 'true';
    if (this.apiKey && allowBrowser) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true,
      });
      this.isEnabled = true;
      console.log('✅ OpenAI key + VITE_OPENAI_ALLOW_BROWSER set — browser AI search enabled.');
    } else if (this.apiKey && !allowBrowser) {
      console.warn('⚠️ OpenAI key present but VITE_OPENAI_ALLOW_BROWSER!=true — browser AI search stays OFF (the key would otherwise ship in the bundle).');
    } else {
      console.warn('⚠️ OpenAI API key not found. AI search is disabled.');
    }
  }

  public isAISearchEnabled(): boolean {
    return this.isEnabled;
  }

  public async getChatCompletion(prompt: string, options: Partial<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming> = {}) {
    if (!this.isEnabled) {
      throw new Error('AI search is not enabled. Please provide an OpenAI API key.');
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        ...options,
      });
      return completion.choices[0]?.message?.content;
    } catch (error) {
      console.error('Error getting chat completion:', error);
      throw new Error('Failed to get chat completion from OpenAI.');
    }
  }

  public async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isEnabled) {
      throw new Error('AI search is not enabled. Please provide an OpenAI API key.');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });
      return response.data.map((embedding) => embedding.embedding);
    } catch (error) {
      console.error('Error getting embeddings:', error);
      throw new Error('Failed to get embeddings from OpenAI.');
    }
  }

  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    if (magA === 0 || magB === 0) {
      return 0;
    }
    return dotProduct / (magA * magB);
  }
}

export const aiSearchService = new AISearchService();
