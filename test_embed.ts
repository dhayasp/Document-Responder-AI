import { generateEmbedding } from './src/lib/embeddings.js';

async function run() {
  try {
    const e = await generateEmbedding("Hello world");
    console.log("Success, length:", e.length);
  } catch (err) {
    console.error("Failed:", err);
  }
}
run();
