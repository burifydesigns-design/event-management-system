const { getSupabase, createSupabaseAuthClient } = require('../config/db');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const { data, error } = await getSupabase().auth.admin.createUser({
      email: normalizedEmail, password, email_confirm: true,
      user_metadata: { name: String(name || '').trim() },
    });
    if (error) return res.status(400).json({ message: 'Could not create account' });

    const authClient = createSupabaseAuthClient();
    const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
      email: normalizedEmail, password,
    });
    if (signInError || !sessionData.session) {
      return res.status(400).json({ message: 'Account created, but sign-in could not be completed. Please log in.' });
    }
    const { data: profile, error: profileError } = await getSupabase()
      .from('profiles').select('id,name,email,role').eq('id', data.user.id).single();
    if (profileError) return res.status(500).json({ message: 'Account profile is not ready. Please contact support.' });
    res.status(201).json({ token: sessionData.session.access_token, user: profile });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const authClient = createSupabaseAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(), password,
    });
    if (error || !data.session) return res.status(401).json({ message: 'Invalid email or password' });
    const { data: profile, error: profileError } = await getSupabase()
      .from('profiles').select('id,name,email,role').eq('id', data.user.id).single();
    if (profileError) return res.status(403).json({ message: 'Account profile is not provisioned' });
    res.json({ token: data.session.access_token, user: profile });
  } catch (err) { next(err); }
};

exports.getMe = async (req, res) => res.json({ user: req.user });

exports.updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { data, error } = await getSupabase().from('profiles')
      .update({ name: String(name || '').trim() }).eq('id', req.user.userId)
      .select('id,name,email,role').single();
    if (error) return res.status(400).json({ message: 'Could not update profile' });
    res.json({ user: data });
  } catch (err) { next(err); }
};
