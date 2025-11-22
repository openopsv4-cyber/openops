import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const PORT = process.env.AI_PROXY_PORT || 3001;
const MODEL = "deepseek-r1:7b";
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/ai', async (req, res) => {
  console.log('➡️ Request received:', req.body);
  try {
    const { message, context } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const safeContext = context || {};

    // Build a cleaner, more direct prompt for deepseek-r1:7b
    const contextStr = JSON.stringify(safeContext, null, 2);
    const userPrompt = `You are CampusMate AI, a helpful assistant for campus management.

⚠️ CRITICAL: You MUST use EXACT text from the USER DATA below. NEVER make up, summarize, or create example responses. Copy text verbatim from the data fields.

USER DATA (use this to answer questions):
${contextStr}

CRITICAL RULE - READ THIS FIRST:
- You MUST use the EXACT text from the USER DATA. NEVER make up, summarize, or paraphrase content.
- For feedback: Use the EXACT message text from data.feedback[].message field - copy it word-for-word.
- For tasks: Use the EXACT text from data.tasks[].text field - copy it word-for-word.
- For complaints: Use the EXACT description from data.complaints[].description field - copy it word-for-word.
- For events: Use the EXACT title, clubName, and description from data.events[] fields - copy them word-for-word.
- NEVER create example responses or generic text. ALWAYS use the actual data from USER DATA.

IMPORTANT - RESPONSE TYPES:
1. GREETINGS AND GENERAL CONVERSATION:
   - For greetings (hello, hi, hey, how are you, good morning, etc.), respond naturally and friendly.
   - For general questions not related to campus data, respond helpfully.
   - NEVER say "I don't have access" for greetings or general conversation.
   - Example: User says "hi" → Respond: "Hello! How can I help you today?" or "Hi there! I'm here to help you with campus tasks, events, complaints, and more. What would you like to know?"

2. CAMPUS DATA QUESTIONS:
   - For questions about campus data (tasks, events, complaints, feedback, permissions), ONLY use information from USER DATA.
   - The USER DATA contains these data types with their exact field names:
     * data.tasks[] - Each task has: text (EXACT task text), status, owner, visibility, createdAt
     * data.events[] - Each event has: title (EXACT title), clubName (EXACT club name), description (EXACT description), status, startDate, endDate, registrationFee, etc.
     * data.complaints[] - Each complaint has: category, description (EXACT complaint text), status, owner, createdAt
     * data.permissions[] - Each permission has: filename (EXACT filename), uploadedBy, createdAt
     * data.feedback[] - Each feedback has: message (EXACT feedback text - USE THIS VERBATIM), rating (1-5 or null), owner, createdAt
     * user - Current user information (username, role, name, usn, email)
     * role - User's role (admin, coordinator, or user)

   - When answering questions, use EXACT field values from USER DATA:
     * "What are my tasks?" → For each task in data.tasks[], show: task.text (EXACT text) and task.status
     * "What events are coming up?" → For each event in data.events[], show: event.title (EXACT), event.clubName (EXACT), event.status, formatted dates
     * "Show complaints" → For each complaint in data.complaints[], show: complaint.category, complaint.description (EXACT text), complaint.status
     * "Show permissions" → For each permission in data.permissions[], show: permission.filename (EXACT filename), permission.uploadedBy
     * "Show feedback" or "What feedbacks are there?" → For each feedback in data.feedback[], show: feedback.message (EXACT text - copy verbatim), feedback.rating (if exists), feedback.owner

   - If the requested information is NOT in the USER DATA, respond: "I don't have access to that information in your data."
   - If data arrays are empty, say so naturally (e.g., "You don't have any tasks yet" or "No events are scheduled at the moment")

- RESPONSE FORMATTING RULES (CRITICAL - Follow these exactly):
  * ALWAYS use the EXACT text from the data fields - never summarize or make up content
  * Convert all timestamps to readable dates: "January 21, 2025" or "Jan 21, 2025 at 3:30 PM"
  * NEVER show technical IDs (like task_1763742098619_2hisv02cs) - completely ignore them
  * Use simple bullets (•) for lists - one item per line
  * Add a blank line between different sections
  * Keep each line concise and readable
  
  * FORMATTING EXAMPLES (using EXACT data from USER DATA):
    If data.tasks[0].text = "Submit assignment" and status = "Pending":
      Show: "• Submit assignment (Pending)"
    
    If data.feedback[0].message = "cholo ada vebbshite" and rating = 5 and owner = "admin":
      Show: "• cholo ada vebbshite ⭐⭐⭐⭐⭐ (submitted by admin)"
      (Note: Use the EXACT message text "cholo ada vebbshite" - do not change it)
    
    If data.complaints[0].description = "soijsoijsoijsoijsojisoijsoijosijoijs" and category = "Infrastructure":
      Show: "• Infrastructure - soijsoijsoijsoijsojisoijsoijosijoijs (Under Review)"
      (Note: Use the EXACT description text - do not summarize)
  
  * STRUCTURE YOUR RESPONSE:
    1. Start with a brief introduction if listing multiple items
    2. Group items by type (all tasks together, all events together, etc.)
    3. Use clear section breaks with blank lines
    4. End with a helpful closing if appropriate
  
  * DO NOT:
    - Use markdown headers (###, ##, #)
    - Show raw timestamps or IDs
    - Crowd information together
    - Use complex formatting or tables
    - Show empty arrays or null values
    - MAKE UP OR SUMMARIZE CONTENT - ALWAYS USE EXACT TEXT FROM DATA FIELDS
    - Create example responses - use the actual data from USER DATA
    - Say "I don't have access" for greetings or general conversation

- Always provide a complete, natural response. Never leave your response empty.
- Do not make up information that isn't in the USER DATA.
- IMPORTANT: The USER DATA is automatically updated with the latest information - no training needed. Just use whatever data is in the USER DATA object.

USER QUESTION: ${message}

ASSISTANT RESPONSE:`;

    const ollamaResponse = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false, // Disable streaming to get complete response
        messages: [
          { 
            role: "system", 
            content: "You are CampusMate AI, a helpful assistant. Always provide complete, natural responses. Never respond with empty content." 
          },
          { 
            role: "user", 
            content: userPrompt
          }
        ],
      }),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.error('[AI Proxy] Ollama error response:', errorText);
      return res
        .status(ollamaResponse.status)
        .json({ error: errorText || 'Ollama request failed.' });
    }

    const raw = await ollamaResponse.text();
    console.log('[AI Proxy] Raw response length:', raw.length);
    console.log('[AI Proxy] Raw response preview:', raw.substring(0, 300));

    // Parse the response - could be single JSON or multiple JSON lines (streaming)
    let data = null;
    let reply = null;
    let allChunks = [];

    try {
      // Try parsing as single JSON first
      data = JSON.parse(raw);
    } catch (e) {
      // If that fails, try extracting JSON lines (for streaming responses)
      const lines = raw.trim().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            const chunk = JSON.parse(trimmed);
            allChunks.push(chunk);
            // Use the last complete chunk
            if (chunk.done === true || chunk.message) {
              data = chunk;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
      
      // If we still don't have data, use the last chunk
      if (!data && allChunks.length > 0) {
        data = allChunks[allChunks.length - 1];
      }
      
      if (!data) {
        console.error("❌ No valid JSON found in response");
        console.error("First 500 chars:", raw.substring(0, 500));
        return res.status(500).json({ error: "⚠ Model returned invalid format. Check server logs." });
      }
    }

    // Extract content from response - handle multiple possible formats
    if (data) {
      // For streaming responses, accumulate content from all chunks
      if (allChunks.length > 0) {
        reply = allChunks
          .map(chunk => {
            if (chunk.message && chunk.message.content) {
              return chunk.message.content;
            }
            return null;
          })
          .filter(content => content !== null)
          .join('');
      }
      
      // If we didn't get content from streaming, try standard fields
      if (!reply) {
        // Check for content in message object (most common format)
        if (data.message && typeof data.message === 'object' && data.message.content) {
          reply = data.message.content;
        }
        // Check for direct content field
        if (!reply && data.content) {
          reply = data.content;
        }
        // Check for response field
        if (!reply && data.response) {
          reply = data.response;
        }
        // Check for text field
        if (!reply && data.text) {
          reply = data.text;
        }
      }
    }

    // Validate we got actual content
    if (!reply || (typeof reply === 'string' && reply.trim().length === 0)) {
      console.error("❌ Empty or missing content in model response");
      console.error("Full response data:", JSON.stringify(data, null, 2));
      
      // If we have the full data object, return a helpful error
      if (data && data.message && data.message.content === "") {
        return res.status(500).json({ 
          error: "⚠ Model returned empty response. The model may need different prompting or the context may be too large. Check server logs for details." 
        });
      }
      
      return res.status(500).json({ 
        error: "⚠ Model returned empty response. Please check server logs and try rephrasing your question." 
      });
    }

    console.log('[AI Proxy] Extracted reply length:', reply.length);
    console.log('[AI Proxy] Reply preview:', reply.substring(0, 200));
    
    return res.json({ response: reply });
  } catch (error) {
    console.error('❌ AI Proxy Error:', error);
    return res.status(500).json({ error: 'Proxy failed to communicate with Ollama.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Proxy running on http://localhost:${PORT}`);
});
