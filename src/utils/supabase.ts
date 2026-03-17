import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sxzekgatdasfkjoahtim.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emVrZ2F0ZGFzZmtqb2FodGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzQ5NDIsImV4cCI6MjA4OTI1MDk0Mn0.-mPaluyG8H5DEIc9rV2Y3yYqBRv3CvLhTidSEHvwH_E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
