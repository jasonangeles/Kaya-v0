import { GoogleGenAI } from "@google/genai";
import { Asset, Currency } from '../types';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const getWealthInsights = async (assets: Asset[], totalNetWorthPHP: number) => {
  const client = getClient();
  if (!client) {
    return "API Key missing. Cannot generate insights.";
  }

  // Sanitize data for privacy (remove IDs, exact names if needed, though prompt is generic)
  const portfolioSummary = assets.map(a => ({
    category: a.category,
    amount: a.amount,
    currency: a.currency,
    institution: a.institution || 'Unknown'
  }));

  const prompt = `
    Act as a financial advisor for an Overseas Filipino Worker (OFW). 
    Here is a portfolio summary: ${JSON.stringify(portfolioSummary)}.
    Total Estimated Net Worth in PHP: ${totalNetWorthPHP.toLocaleString()}.

    Provide 3 short, punchy, localized insights (max 1 sentence each).
    Focus on:
    1. Inflation in the Philippines vs holding assets in USD/CAD.
    2. Crypto exposure risk/reward (if any).
    3. Encouragement on saving habits.
    
    Tone: Modern, friendly, encouraging (like Duolingo). 
    Format: Return a JSON array of strings. Example: ["Tip 1", "Tip 2", "Tip 3"].
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return ["Keep tracking your daily expenses to stay on top!", "Diversify your assets to beat inflation.", "Great job on maintaining your streak!"];
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return [
      "Diversifying between PHP and USD can help hedge against local inflation.",
      "Crypto assets are volatile; ensure you have a stable emergency fund first.",
      "Consistency is key! Keep updating your wealth tracker."
    ];
  }
};