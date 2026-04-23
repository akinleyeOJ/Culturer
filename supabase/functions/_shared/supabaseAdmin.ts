// Shared Supabase clients for Edge Functions.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const getSupabaseAdmin = (): SupabaseClient =>
    createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

export const getSupabaseUserClient = (authHeader: string): SupabaseClient =>
    createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
    )
