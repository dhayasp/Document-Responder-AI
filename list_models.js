const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function list() {
  try {
    const response = await ai.models.list();
    console.log("Available models:");
    for await (const model of response) {
      if (model.name.includes("flash") || model.name.includes("pro")) {
         console.log(model.name);
      }
    }
  } catch(e) {
    console.error("Error:", e);
  }
}

list();
