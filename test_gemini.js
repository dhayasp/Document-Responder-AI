const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    console.log("Key:", process.env.GEMINI_API_KEY);
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: 'hello world',
    });
    console.log("Embedding:", response.embeddings?.[0]?.values?.slice(0, 5));
  } catch(e) {
    console.error("Error:", e);
  }
}

test();
