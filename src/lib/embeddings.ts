import { pipeline, env } from '@xenova/transformers';

// Configure transformers to use /tmp for caching models on Vercel
// Vercel serverless environments have a read-only filesystem except for /tmp
env.cacheDir = '/tmp/.cache';
env.allowLocalModels = false;

let extractorInstance: any = null;

// Use server-side lazy loaded singleton for pipeline
async function getExtractor() {
  if (!extractorInstance) {
    // using all-MiniLM-L6-v2 which creates 384 dimensional vectors locally
    extractorInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true, // run fast
    });
  }
  return extractorInstance;
}

// Generates embeddings locally without Google API
export async function generateEmbedding(text: string) {
  try {
    const extractor = await getExtractor();
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  } catch (error: any) {
    console.error('Error generating embedding', error);
    throw new Error(`Embedding Generation Failed: ${error.message}`);
  }
}

// Simple text chunking by characters or words
export function chunkText(text: string, maxTokens: number = 500) {
  // Approximate 1 token = 4 chars
  const maxChars = maxTokens * 4;
  const chunks = [];
  let currentIndex = 0;
  
  // Basic greedy chunking by sentence/period or fallback to length
  while (currentIndex < text.length) {
    let nextIndex = currentIndex + maxChars;
    if (nextIndex < text.length) {
      const periodIdx = text.lastIndexOf('.', nextIndex);
      if (periodIdx > currentIndex) {
        nextIndex = periodIdx + 1;
      } else {
        const spaceIdx = text.lastIndexOf(' ', nextIndex);
        if (spaceIdx > currentIndex) {
          nextIndex = spaceIdx + 1;
        }
      }
    }
    const chunk = text.substring(currentIndex, nextIndex).trim();
    if (chunk.length > 0) chunks.push(chunk);
    currentIndex = nextIndex;
  }
  return chunks;
}
