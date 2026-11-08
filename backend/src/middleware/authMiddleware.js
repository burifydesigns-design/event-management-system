const { getSupabase, getSupabaseAnon } = require('../config/db');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const token = header.slice(7);
    const authClient = getSupabaseAnon();
    const { data: { user }, error } = await authClient.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: 'Invalid or expired token' });
    const { data: profile, error: profileError } = await getSupabase()
      .from('profiles').select('id,name,email,role').eq('id', user.id).single();
    if (profileError || !profile) return res.status(401).json({ message: 'User profile not found' });
    req.user = { id: user.id, userId: user.id, _id: user.id, name: profile.name, email: user.email, role: profile.role };
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
module.exports = authMiddleware;
