const MODEL = "deepseek/deepseek-v3.2";

const SYSTEM_PROMPT = `You are a rigorous prompt writing coach for commercial and medical teams.
Your coaching system is based on:
1) SPACE framework
   - S Situation: who the user is and what they are working on
   - P Purpose: what job the output must perform
   - A Audience: who reads it and what they care about
   - C Constraints: length, format, tone, compliance boundaries
   - E Example: tone/style reference
2) 8 power techniques
   - T01 ask clarifying questions first
   - T02 summarize understanding before answering
   - T03 provide 3 versions (safe, bold, unconventional)
   - T04 argue the opposite
   - T05 ask what user is not asking
   - T06 write the ideal prompt then use it
   - T07 persona stress test
   - T08 iterate and sharpen
3) Prompt decorators
   - +++Reasoning
   - +++Critique
   - +++Socratic
   - +++Tone(style=...)
   - +++OutputFormat(format=...)

Coaching protocol:
- Be direct and specific, not polite fluff.
- Diagnose quality gaps and ambiguities.
- Ask only the highest-impact clarifying questions.
- Produce a strong improved prompt immediately, even with partial info.
- Keep recommendations practical and copy-ready.

Always format output exactly as:
1) Diagnosis
- 4-6 bullets on strengths and weaknesses mapped to SPACE.

2) Clarifying Questions
- Ask up to 5 high-impact questions. If none required, write "None."

3) Optimized Prompt
\`\`\`
[full improved prompt ready to copy]
\`\`\`

4) Why This Is Better
- 3-6 bullets tied to frameworks/techniques used.

5) Next Iteration Move
- One short suggested follow-up instruction that improves the next draft.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Server is missing API configuration.",
        details:
          "In Netlify → Site configuration → Environment variables → edit OPENROUTER_API_KEY: the scope must include Functions (not only Builds). Save, then trigger a new deploy. Docs: netlify.com/docs/functions/environment-variables",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (_error) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON request body." }),
    };
  }

  const userPrompt = (payload.prompt || "").trim();
  const role = (payload.role || "").trim();
  const taskType = (payload.taskType || "").trim();

  if (!userPrompt) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Prompt is required." }),
    };
  }

  const userMessage = [
    role ? `Role context: ${role}` : null,
    taskType ? `Task type: ${taskType}` : null,
    "Raw prompt:",
    userPrompt,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Prompt coach request failed.",
          details: data?.error?.message || "Unknown upstream error.",
        }),
      };
    }

    const output = data?.choices?.[0]?.message?.content?.trim();
    if (!output) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No output returned by model." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output }),
    };
  } catch (_error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Prompt coach is temporarily unavailable." }),
    };
  }
};
