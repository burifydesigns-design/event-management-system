const { createClient } = require('@supabase/supabase-js');

let supabase;
function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabase;
}
async function connectDB() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('Supabase startup check skipped: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }
  try {
    const client = getSupabase();
    const { error } = await client.from('events').select('id').limit(1);
    if (error) console.warn(`Supabase startup check warning: ${error.message}`);
    else console.log('Supabase connected');
  } catch (err) {
    console.warn(`Supabase startup check warning: ${err && err.message ? err.message : err}`);
  }
}
module.exports = connectDB;
module.exports.getSupabase = getSupabase;
