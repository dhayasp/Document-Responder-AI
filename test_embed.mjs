require('dotenv').config({ path: '.env.local' });
const { generateEmbedding } = require('./src/lib/embeddings.js'); // Wait, Next.js uses TS

async function run() {
  try {
    const e = await generateEmbedding("Hello world");
    console.log("Success, length:", e.length);
  } catch (err) {
    console.error("Failed:", err);
  }
}
run();
