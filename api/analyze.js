export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured.' });

  const { image, style, customStyle } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided.' });

  // ── Tier check ──
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  let userId = null;
  let tier = 'free';
  let analysesThisMonth = 0;

  if (token) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      const user = await userRes.json();
      if (user.id) {
        userId = user.id;
        const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
          headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
        });
        const profiles = await profileRes.json();
        const profile = profiles[0];
        if (profile) {
          tier = profile.tier || 'free';
          analysesThisMonth = profile.analyses_this_month || 0;
        }
      }
    } catch(e) {}
  }

  // Free tier limit = 5/month
  if (tier === 'free' && analysesThisMonth >= 5) {
    return res.status(403).json({
      error: 'limit_reached',
      message: 'You have used your 5 free analyses this month. Upgrade to Tonal Pro for unlimited analyses.',
      analyses_used: analysesThisMonth
    });
  }

  // Not logged in at all — allow 1 anonymous try
  if (!userId && !token) {
    // Let it through — no saving
  }

  const styleName = customStyle || style || 'any photographic style';

  const systemPrompt = `You are an expert photo editor, cinematographer, and photography mentor. Analyse the uploaded photo for the style the photographer intends.

Respond ONLY with a JSON object, no markdown, no backticks:
{
  "style": "style name as given",
  "score": 72,
  "score_label": "short phrase e.g. Strong foundation",
  "points_away": 28,
  "why_it_reads": "2-3 sentences on what the photo is doing well and why it reads this way. Specific visual details.",
  "whats_missing": ["specific thing", "specific thing", "specific thing"],
  "composition": "2-3 sentences on framing, subject placement, leading lines, balance. What works and what could improve.",
  "masking": "2-3 sentences on specific local adjustments — which part of the image would benefit from a mask and what to apply.",
  "corrections": [
    { "name": "Highlights", "value": "-20", "reason": "Recovers roll-off character" },
    { "name": "Blacks", "value": "+15", "reason": "Lifts shadows from pure black" }
  ],
  "encouragement": "One short sentence of genuine encouragement.",
  "alternative_style": "If score below 55 — what style this actually looks like. Otherwise null.",
  "alternative_note": "If score below 55 — one conversational sentence about it. Otherwise null."
}

Include 3-5 whats_missing and 4-7 corrections.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: `Analyse this photo. Style: ${styleName}` }
        ]}]
      })
    });

    if (!response.ok) {
      let msg = `API error ${response.status}`;
      try { const e = await response.json(); msg = e.error?.message || msg; } catch(x) {}
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data.content.map(i => i.text || '').join('');
    let result;
    try {
      result = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch(e) {
      return res.status(500).json({ error: 'Analysis response was too long. Try a simpler style description or smaller image.' });
    }

    // Pass back tier info so frontend knows state
    result._tier = tier;
    result._analyses_used = analysesThisMonth + 1;
    result._user_id = userId;

    return res.status(200).json(result);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
