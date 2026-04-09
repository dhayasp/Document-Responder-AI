const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testModels() {
  const modelsToTest = [
    'gemini-2.5-pro',
    'gemini-3.1-flash-live-preview-preview-12-2025'
  ];
  for (const model of modelsToTest) {
    console.log(`Testing ${model}...`);
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: 'reply with just "ok"',
      });
      console.log(`[SUCCESS] ${model} works: ${response.text.trim()}`);
    } catch(e) {
      console.error(`[FAIL] ${model}: ${e.message}`);
    }
  }
}

testModels();
