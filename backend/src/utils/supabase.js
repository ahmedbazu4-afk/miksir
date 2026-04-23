const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

// Service client — full admin access, used server-side only
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = supabase;
