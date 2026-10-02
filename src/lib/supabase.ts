import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xgcahognmqqsglzyymyo.supabase.co';
const supabaseAnonKey = 'sb_publishable_YBWXbd--JDU52NtnOFTFFA_GAb2x5vu';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});