/* CivicPulse AI — Supabase Client & Authentication Service */

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Send a 6-digit email OTP to the specified email address.
 * Uses signInWithOtp with shouldCreateUser: true so both sign-in and sign-up work seamlessly.
 */
export async function sendEmailOtp(email: string) {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment variables.'
    );
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Verify the 6-digit OTP code sent to the email address.
 * Type is explicitly 'email'.
 */
export async function verifyEmailOtp(email: string, token: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign out the currently authenticated Supabase user.
 */
export async function signOutSupabase() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Supabase signOut warning:', error.message);
    }
  }
}

/**
 * Get current active session if any.
 */
export async function getSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Update the user profile and verification metadata in Supabase Auth.
 */
export async function updateSupabaseProfile(metadata: {
  full_name?: string;
  phone_number?: string;
  city_district?: string;
  citizen_type?: string;
  is_verified?: boolean;
  profile_completed?: boolean;
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.updateUser({
    data: metadata,
  });

  if (error) {
    throw error;
  }

  return data;
}

export type { Session, User };
