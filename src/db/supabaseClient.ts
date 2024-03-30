import { createClient } from '@supabase/supabase-js';

// Supabase service key and URL from environment variables
const supabaseUrl = "https://yvpvhbgcawvruybkmupv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2cHZoYmdjYXd2cnV5YmttdXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTA3NDQ1NzMsImV4cCI6MjAyNjMyMDU3M30.Nei8o17EhYNF_j5je1oz2ZBQ95hCthBQgEa-n3VyK5U";

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or service key is missing.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
