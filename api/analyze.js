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

  const systemPrompt = `You are an expert photo editor, cinematographer, and photography mentor. A photographer has uploaded a photo and told you the style they are going for.

Score how close the photo is to that style (0-100), explain why it reads the way it does, identify what is holding it back, give Lightroom correction values, give composition feedback, suggest masking opportunities, and if score is below 55 suggest what style the photo actually looks like.

Respond ONLY with a JSON object, no markdown, no backticks:
{
  "style": "the style name as given",
  "score": 72,
  "score_label": "one short phrase e.g. Strong foundation",
  "points_away": 28,
  "why_it_reads": "2-3 sentences on what the photo is doing well and why it reads this way. Specific visual details.",
  "whats_missing": ["One specific thing", "Another thing", "Another thing"],
  "composition": "2-3 sentences on framing, rule of thirds, leading lines, subject placement, negative space, balance. What is working and what could improve.",
  "masking": "2-3 sentences suggesting specific local adjustments — which part of the image (sky, subject, foreground, shadows in corner etc.) would benefit from a radial or gradient mask, and what to apply there.",
  "corrections": [
    { "name": "Highlights", "value": "-20", "reason": "Recovers roll-off character" },
    { "name": "Blacks", "value": "+15", "reason": "Lifts shadows from pure black" }
  ],
  "encouragement": "One short sentence of genuine encouragement.",
  "alternative_style": "If score below 55: name of what style this actually looks like. Otherwise null.",
  "alternative_note": "If score below 55: one sentence like: This photo reads more as [alternative] than [intended style] — want to score it against that instead? Otherwise null."
}

Include 3-5 whats_missing items and 4-7 corrections.`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: `Analyse this photo. Style I am going for: ${styleName}` }
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
    const clean = text.replace(/```json|```/g, '').trim();
    let result;
    try {
      result = JSON.parse(clean);
    } catch(parseErr) {
      return res.status(500).json({ error: 'The analysis was too long to complete. Try a smaller image or a simpler style description.' });
    }
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
