export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured. Add ANTHROPIC_API_KEY in Vercel environment variables.' });

  const { image, style, customStyle } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided.' });

  const styleName = customStyle || style || 'any photographic style';

  const systemPrompt = `You are an expert photo editor and cinematographer with deep knowledge of photographic styles, colour grading, and editing technique. A photographer has uploaded a photo and told you the style they are going for.

Your job is to:
1. Score how close the photo is to achieving that style (0–100)
2. Explain why it reads the way it does — be specific about what is working
3. Identify precisely what is holding it back from a perfect score
4. Give exact Lightroom correction values to close the gap

The tone of your feedback is like a trusted mentor — honest, specific, and encouraging. You are helping the photographer grow, not judging their work.

Respond ONLY with a JSON object, no markdown, no backticks:
{
  "style": "the style name as given",
  "score": 72,
  "score_label": "one short phrase describing this score level e.g. Strong foundation or Almost there or Getting closer",
  "points_away": 28,
  "why_it_reads": "2-3 sentences on what the photo is doing well and why it reads the way it does. Be specific about colour, light, contrast, texture.",
  "whats_missing": [
    "One specific thing holding it back, written as a plain sentence",
    "Another specific thing",
    "Another specific thing"
  ],
  "corrections": [
    { "name": "Highlights", "value": "-20", "reason": "Recovers the roll-off character of the style" },
    { "name": "Blacks", "value": "+15", "reason": "Lifts shadows away from pure black" },
    { "name": "Temp", "value": "+250K", "reason": "Pushes warmth toward the analogue palette" }
  ],
  "encouragement": "One short sentence of genuine encouragement about what the photographer is already doing well."
}

Include 3-5 items in whats_missing and 4-7 corrections. Be specific and actionable.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: `Please analyse this photo. The style I am going for is: ${styleName}` }
          ]
        }]
      })
    });

    if (!response.ok) {
      let msg = `API error ${response.status}`;
      try { const e = await response.json(); msg = e.error?.message || msg; } catch(x) {}
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data.content.map(i => i.text || '').join('');
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
