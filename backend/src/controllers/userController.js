const { getSupabase } = require('../config/db');
const db = () => getSupabase();

exports.createStaffUser = async (req, res, next) => {
  let createdUserId;
  try {
    const { name, email, password, role } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!String(name || '').trim() || !normalizedEmail || !password || String(password).length < 10) {
      return res.status(400).json({ message: 'Name, valid email and password of at least 10 characters are required' });
    }
    if (!['coordinator', 'organizer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be coordinator or organizer' });
    }
    const { data, error } = await db().auth.admin.createUser({
      email: normalizedEmail, password, email_confirm: true,
      user_metadata: { name: String(name).trim() },
    });
    if (error) return res.status(400).json({ message: error.message });
    createdUserId = data.user.id;

    const { data: profile, error: profileError } = await db().from('profiles')
      .update({ name: String(name).trim(), role }).eq('id', createdUserId)
      .select('id,name,email,role').single();
    if (profileError) {
      await db().auth.admin.deleteUser(createdUserId);
      throw profileError;
    }
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const { data, error } = await db().from('profiles')
      .select('id,name,email,role,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
};
