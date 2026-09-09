import { createClient } from '@supabase/supabase-js';

import { getLocalSetting, removeLocalSetting, setLocalSetting } from '../storage/localStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        // Keep the guardian session in the app's local SQLite store. This is
        // available in Expo Go as well as an installable Android build.
        storage: {
          getItem: (key) => getLocalSetting(`supabase-auth:${key}`),
          setItem: (key, value) => setLocalSetting(`supabase-auth:${key}`, value),
          removeItem: (key) => removeLocalSetting(`supabase-auth:${key}`),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
