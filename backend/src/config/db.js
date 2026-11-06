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
  const client = getSupabase();
  const { error } = await client.from('events').select('id').limit(1);
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  console.log('Supabase connected');
}
module.exports = connectDB;
module.exports.getSupabase = getSupabase;
