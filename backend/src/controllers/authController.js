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

// Always return the same response so callers cannot discover whether an email is registered.
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const allowedOrigins = (process.env.FRONTEND_URL || '')
      .split(',').map((value) => value.trim()).filter(Boolean);
    const requestOrigin = req.get('origin');
    const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
    if (!origin && !process.env.PASSWORD_RESET_REDIRECT_URL) {
      return res.status(503).json({ message: 'Password reset is not configured. Please contact support.' });
    }
    const redirectTo = process.env.PASSWORD_RESET_REDIRECT_URL || `${origin}/reset-password`;
    const authClient = createSupabaseAuthClient();
    const { error } = await authClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      // Avoid exposing provider details or account existence to the caller.
      console.error('Password reset request failed:', error.message);
      return res.status(502).json({ message: 'Unable to send a reset email right now. Please try again later.' });
    }
    return res.json({ message: 'If an account matches that email, a reset link will be sent.' });
  } catch (err) { next(err); }
};

exports.completePasswordReset = async (req, res, next) => {
  try {
    const { accessToken, refreshToken, password } = req.body || {};
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' ||
        accessToken.length > 4096 || refreshToken.length > 4096) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired. Request a new one.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Your new password must be between 8 and 128 characters.' });
    }

    // Possession of the short-lived recovery session is required to change the password.
    const authClient = createSupabaseAuthClient();
    const { error: sessionError } = await authClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired. Request a new one.' });
    }
    const { error } = await authClient.auth.updateUser({ password });
    if (error) {
      return res.status(400).json({ message: 'Could not update the password. Request a new reset link and try again.' });
    }
    await authClient.auth.signOut();
    return res.json({ message: 'Your password has been updated. You can now sign in.' });
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
