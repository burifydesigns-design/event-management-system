const { getSupabase } = require('../config/db');

const SELECT = 'id,name,email,role';

module.exports = {
  async findOne(filter = {}, opts = {}) {
    let q = getSupabase().from('profiles').select(opts.select || SELECT);
    if (filter && filter.email) q = q.ilike('email', String(filter.email));
    if (filter && filter.id) q = q.eq('id', filter.id);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data;
  },
  async findById(id, opts = {}) {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select(opts.select || SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async find(filter = {}) {
    let q = getSupabase().from('profiles').select(SELECT).order('created_at', { ascending: false });
    if (filter && filter.role) q = q.eq('role', filter.role);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async countDocuments() {
    const { count, error } = await getSupabase().from('profiles').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },
};
