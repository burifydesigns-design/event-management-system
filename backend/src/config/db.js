const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin;
let supabaseAnon;

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
  };
}

function getSupabase() {
  if (!supabaseAdmin) {
    const { url, serviceRoleKey } = getSupabaseConfig();
    if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}

function getSupabaseAnon() {
  if (!supabaseAnon) {
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
    supabaseAnon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAnon;
}

// A fresh client prevents one user's sign-in from mutating a shared client session.
function createSupabaseAuthClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function connectDB() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!url || !serviceRoleKey) {
    console.warn('Supabase startup check skipped: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }
  try {
    const { error } = await getSupabase().from('events').select('id').limit(1);
    if (error) console.warn(`Supabase startup check warning: ${error.message}`);
    else console.log('Supabase connected');
  } catch (err) {
    console.warn(`Supabase startup check warning: ${err && err.message ? err.message : err}`);
  }
}

module.exports = connectDB;
module.exports.getSupabase = getSupabase;
module.exports.getSupabaseAnon = getSupabaseAnon;
module.exports.createSupabaseAuthClient = createSupabaseAuthClient;
