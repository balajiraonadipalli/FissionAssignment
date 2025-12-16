import express from "express";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// POST /api/ai/generate-description - Generate event description using Gemini AI
router.post("/generate-description", authMiddleware, async (req, res) => {
  try {
    const { title, category, location, dateTime } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        message: "AI service is not configured. Please set GEMINI_API_KEY in environment variables." 
      });
    }

    // Prepare the prompt for Gemini
    const dateText = dateTime ? new Date(dateTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }) : "";

    const prompt = `Generate a compelling and engaging event description for the following event:

Title: ${title}
${category ? `Category: ${category}` : ''}
${location ? `Location: ${location}` : ''}
${dateText ? `Date & Time: ${dateText}` : ''}

Please create a professional, engaging event description that:
- Is between 100-200 words
- Highlights the key aspects of the event
- Makes it appealing to potential attendees
- Includes relevant details about what attendees can expect
- Uses an enthusiastic but professional tone

Generate only the description text, without any additional formatting or labels.`;

    try {
      // Use REST API directly - try gemini-flash-latest first (faster, better quota)
      // Fallback to gemini-2.0-flash if quota exceeded
      const modelsToTry = [
        "gemini-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-pro-latest"
      ];

      let lastError = null;
      let success = false;

      for (const modelName of modelsToTry) {
        try {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }]
            })
          });

          const data = await response.json();

          if (response.ok) {
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (generatedText) {
              console.log(`✅ Successfully generated description using ${modelName}`);
              return res.json({ description: generatedText.trim() });
            }
          } else {
            // Check if it's a quota error - try next model
            if (data.error?.message?.includes("quota") || data.error?.message?.includes("Quota exceeded")) {
              console.log(`⚠️  Quota exceeded for ${modelName}, trying next model...`);
              lastError = data.error;
              continue; // Try next model
            }
            
            // For other errors, return immediately
            lastError = data.error;
            break;
          }
        } catch (fetchError) {
          console.error(`Error with model ${modelName}:`, fetchError.message);
          lastError = fetchError;
          continue; // Try next model
        }
      }

      // If all models failed, return appropriate error
      if (lastError) {
        if (lastError.message?.includes("quota") || lastError.message?.includes("Quota exceeded")) {
          return res.status(429).json({ 
            message: "API quota exceeded for all models. Please check your Google Cloud billing or wait for quota reset." 
          });
        }
        
        if (lastError.message?.includes("overloaded")) {
          return res.status(503).json({ 
            message: "AI service is temporarily overloaded. Please try again in a moment." 
          });
        }

        console.error("Gemini API error:", lastError);
        return res.status(500).json({ 
          message: lastError.message || "Failed to generate description. Please check your API key and try again." 
        });
      }

      return res.status(500).json({ 
        message: "Failed to generate description. All models failed." 
      });
    } catch (fetchError) {
      console.error("Gemini API fetch error:", fetchError);
      return res.status(500).json({ 
        message: "Failed to generate description. Please check your internet connection and try again." 
      });
    }
  } catch (err) {
    console.error("AI description generation error", err);
    return res.status(500).json({ message: "Failed to generate description" });
  }
});

export default router;
