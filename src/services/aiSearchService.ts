import OpenAI from 'openai';

class AISearchService {
  private openai: OpenAI;
  private apiKey: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || null;
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true,
      });
      this.isEnabled = true;
      console.log('✅ OpenAI API key found, AI search is enabled.');
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
