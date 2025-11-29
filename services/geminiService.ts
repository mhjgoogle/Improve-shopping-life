import { GoogleGenAI, Schema, Type } from "@google/genai";
import { ShoppingPhase, RequiredAction, ShoppingResponse, Product } from "../types";

const API_KEY = process.env.API_KEY || '';

// Define the response schema for strict JSON output
const shoppingResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    thought: { type: Type.STRING, description: "Internal reasoning about the current state and user intent (English)" },
    user_message: { type: Type.STRING, description: "The response to show to the user (Natural Japanese)" },
    current_phase: {
      type: Type.STRING,
      enum: Object.values(ShoppingPhase),
      description: "The current phase of the shopping journey"
    },
    required_action: {
      type: Type.STRING,
      enum: Object.values(RequiredAction),
      description: "Action required by the frontend"
    },
    tool_parameters: {
      type: Type.OBJECT,
      description: "Optional parameters for tool calls",
      properties: {
        search_query: { type: Type.STRING },
        vton_prompt: { type: Type.STRING }
      }
    }
  },
  required: ["thought", "user_message", "current_phase", "required_action"],
};

const SYSTEM_INSTRUCTION = `
**Role:**
You are the "Visual Shopping Assistant," an AI specialized in helping users find fashion items or furniture accessories, visualizing them, and evaluating the results.

**Primary Goal:**
Guide the user through a structured shopping journey, from identifying needs to virtual try-on and evaluation.

**Response Format:**
You must **ALWAYS** respond with a valid JSON object adhering to the schema provided.

**Workflow Logic (State Machine):**

**Phase 1: IDENTIFY_SUBJECT (Object Classification)**
* **Logic:** Analyze if the user wants to buy a "Subject" (e.g., Sofa, Doll) or an "Accessory" (e.g., Sofa Cover, Doll Clothes, Human Clothes).
* **Rule:**
    * If **Accessory** (needs a base subject): Transition to GET_USER_IMAGE.
    * If **Subject** (standalone): Transition to PREFERENCE_SEARCH.

**Phase 2: GET_USER_IMAGE (Image Acquisition)**
* **Logic:** If the user wants an accessory (e.g., a dress), we need the base image (the user's photo).
* **Action:** Politely ask the user to upload a photo of the subject (themselves or their furniture).
* **Transition:** Once the image is received (detected in input), transition to PREFERENCE_SEARCH.

**Phase 3: PREFERENCE_SEARCH (Search & Confirm)**
* **Logic:** engaging dialogue to narrow down style, color, budget.
* **Action:**
    * If preferences are vague: Ask 1 clarifying question with options (A/B/C).
    * If preferences are clear: Set required_action to CALL_SEARCH_TOOL. Provide a 'search_query' in tool_parameters.
* **Transition:** After search results are returned to the user, transition to SELECT_PRODUCT.

**Phase 4: SELECT_PRODUCT (Selection)**
* **Logic:** The user selects an item from the search results.
* **Action:** Confirm the selection.
* **Transition:**
    * If it's an "Accessory" AND we have a user image: Ask if they want to "Try it on". Transition to VIRTUAL_TRYON.
    * If it's a "Subject": End flow or suggest AR view (future feature).

**Phase 5: VIRTUAL_TRYON (Visualization)**
* **Logic:** User requested a try-on.
* **Action:** Set required_action to CALL_VTON_TOOL. Provide a 'vton_prompt' in tool_parameters (e.g., "A person wearing a red summer dress").
* **Transition:** Once the VTON image is generated, transition to EVALUATION.

**Phase 6: EVALUATION (Scoring)**
* **Logic:** Provide a quantitative and qualitative assessment.
* **Action:** Set required_action to CALL_EVAL_TOOL (or generate internal evaluation).
* **Output:** Give a score (1-10) on "Style Match" and "Value".
* **Message:** "Here is the result! Match Score: 8.5/10. [Brief reason]."

**Constraints & Tone:**
1.  **Language:** user_message must be in **Japanese**. thought must be in **English**.
2.  **Brevity:** Keep user_message under 100 characters unless explaining a detailed evaluation. Save tokens.
3.  **Safety:** Do not process images that violate safety policies (NSFW).
`;

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const sendMessageToAgent = async (
  history: { role: string; parts: any[] }[],
  latestMessage: string,
  imageData?: string
): Promise<ShoppingResponse> => {
  try {
    const parts: any[] = [{ text: latestMessage }];

    if (imageData) {
      // Extract base64 data and mime type
      // Format: "data:image/png;base64,..."
      const match = imageData.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    const contents = [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: h.parts
      })),
      { role: "user", parts }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: shoppingResponseSchema,
        temperature: 0.7,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as ShoppingResponse;
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Agent Error:", error);
    // Fallback response in case of parsing error
    return {
      thought: "Error occurred",
      user_message: "申し訳ありません、エラーが発生しました。もう一度お試しください。",
      current_phase: ShoppingPhase.IDENTIFY_SUBJECT,
      required_action: RequiredAction.NONE
    };
  }
};

export const searchProductsWithGemini = async (query: string): Promise<Product[]> => {
  // Using Grounding with Google Search to find real products
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find 3 fashion/furniture products for: "${query}". 
      Return ONLY a JSON array. Each object must have: id, name, price, imageUrl, description.
      Use generic placeholder images from https://picsum.photos if real ones cannot be scraped directly, but prefer real data if grounded.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              price: { type: Type.STRING },
              imageUrl: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      }
    });

    if (response.text) {
      const products = JSON.parse(response.text);
      // Ensure images are valid or fallback
      return products.map((p: any, index: number) => ({
        ...p,
        id: p.id || `prod-${index}`,
        imageUrl: p.imageUrl && p.imageUrl.startsWith('http') ? p.imageUrl : `https://picsum.photos/300/400?random=${index}`
      }));
    }
    return [];
  } catch (e) {
    console.error("Search Error", e);
    // Mock fallback if search fails
    return [
      { id: '1', name: 'Stylish Option A', price: '¥5,000', description: 'A great choice for this style.', imageUrl: 'https://picsum.photos/300/400?random=1' },
      { id: '2', name: 'Premium Option B', price: '¥12,000', description: 'High quality material.', imageUrl: 'https://picsum.photos/300/400?random=2' },
      { id: '3', name: 'Budget Option C', price: '¥2,500', description: 'Affordable and trendy.', imageUrl: 'https://picsum.photos/300/400?random=3' },
    ];
  }
};

export const generateTryOnImage = async (userImage: string, productDescription: string): Promise<string> => {
  try {
    const match = userImage.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data");

    const mimeType = match[1];
    const base64Data = match[2];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // Using image model for editing/generation
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `Replace the clothing or accessory in this image to match this description: ${productDescription}. Keep the person/subject identity and background consistent. High quality, photorealistic.`
          }
        ]
      },
      config: {
        // Note: responseMimeType not supported for image models usually in this SDK version unless specific
      }
    });

    // Check for inline data (image)
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
       for (const part of candidates[0].content.parts) {
         if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
         }
       }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("VTON Error:", error);
    // Return original image as fallback to prevent crash, effectively "no change"
    return userImage;
  }
};
