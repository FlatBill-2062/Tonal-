export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in Vercel environment variables.' });
  }

  const { image, styleOverride } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const overrideNote = styleOverride
    ? `The photographer says this is intended to be in the style of: "${styleOverride}". Analyse it through that specific lens.`
    : 'Identify the cinematic style this photo most closely evokes.';

  const systemPrompt = `You are a world-class cinematographer and photo editor with deep knowledge of directors, visual aesthetics, and photographic movements. Analyse the uploaded photo for its cinematic style.

${overrideNote}

Respond ONLY with a JSON object — no markdown, no backticks:
{
  "aesthetic": "short evocative name e.g. Warm nostalgia",
  "reference": "director or movement e.g. Wes Anderson",
  "film": "one specific film e.g. The Grand Budapest Hotel",
  "match_pct": number between 20 and 95,
  "why": "2-3 sentences on why this photo reads this way, specific visual details",
  "defines": "2 sentences on what technically defines this look",
  "corrections": [
    { "name": "Shadows", "value": "teal tint -15 hue", "reason": "pulls shadows toward the reference aesthetic" },
    { "name": "Highlights", "value": "warm amber +12", "reason": "creates warm/cool tension" },
    { "name": "Contrast", "value": "S-curve, lift blacks", "reason": "avoids pure black" },
    { "name": "Saturation", "value": "reds +25 blues +18", "reason": "pushes signature colour pairs" },
    { "name": "Grain", "value": "add 20 luminance", "reason": "filmic analogue texture" }
  ]
}

Include 4-6 corrections. Be specific and evocative.`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: 'Analyse this photo.' }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const text = data.content.map(i => i.text || '').join('');
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
