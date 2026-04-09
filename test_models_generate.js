const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testModels() {
  const modelsToTest = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
  for (const model of modelsToTest) {
    console.log(`Testing ${model}...`);
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: 'reply with just "ok"',
      });
      console.log(`[SUCCESS] ${model} works: ${response.text}`);
      return; // break on first success to not spam API
    } catch(e) {
      console.error(`[FAIL] ${model}: ${e.message}`);
    }
  }
}

testModels();
