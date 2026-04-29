export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, token } = req.body;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured.' });

  try {
    // ── Sign up ──
    if (action === 'signup') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (data.error) return res.status(400).json({ error: data.error.message || data.msg });
      return res.status(200).json({ user: data.user, token: data.access_token, message: 'Check your email to confirm your account.' });
    }

    // ── Log in ──
    if (action === 'login') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (data.error) return res.status(400).json({ error: data.error_description || data.error });

      // Get profile + tier
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const profiles = await profileRes.json();
      const profile = profiles[0] || { tier: 'free', analyses_this_month: 0 };

      // Reset monthly count if new month
      const today = new Date().toISOString().split('T')[0];
      if (profile.month_reset && profile.month_reset < today.slice(0, 7) + '-01') {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
          body: JSON.stringify({ analyses_this_month: 0, month_reset: today })
        });
        profile.analyses_this_month = 0;
      }

      return res.status(200).json({
        user: { id: data.user.id, email: data.user.email },
        token: data.access_token,
        tier: profile.tier,
        analyses_this_month: profile.analyses_this_month
      });
    }

    // ── Get user from token ──
    if (action === 'me') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.id) return res.status(401).json({ error: 'Invalid session' });

      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.id}`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const profiles = await profileRes.json();
      const profile = profiles[0] || { tier: 'free', analyses_this_month: 0 };

      return res.status(200).json({
        user: { id: data.id, email: data.email },
        tier: profile.tier,
        analyses_this_month: profile.analyses_this_month
      });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
