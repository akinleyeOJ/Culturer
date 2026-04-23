// Supabase Edge Function: stripe-connect-onboard
// -----------------------------------------------
// Two actions (selected via `action` field in the request body):
//
//   action: 'status'   -> Returns the current onboarding state for the
//                         caller's Stripe Connect Express account. Also
//                         syncs profiles.stripe_connect_onboarded when it
//                         has flipped since the last check.
//
//   action: 'onboard'  -> Creates (or re-uses) a Connect Express account
//                         and returns an onboarding URL.
//
// Body:  { action?: 'status' | 'onboard' }   (defaults to 'onboard')
// Auth:  Bearer <supabase user access token>
//
// Response (status):
// {
//   success: true,
//   account_id: string | null,
//   onboarded: boolean,
//   charges_enabled: boolean,
//   payouts_enabled: boolean,
//   requirements_currently_due: string[],
//   requirements_past_due: string[]
// }
//
// Response (onboard):
// { success: true, onboarding_url: string, account_id: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import {
    corsHeaders,
    errorResponse,
    successResponse,
} from '../_shared/furgonetka.ts'
import { getSupabaseAdmin, getSupabaseUserClient } from '../_shared/supabaseAdmin.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const APP_URL_SCHEME = Deno.env.get('APP_URL_SCHEME') || 'culturar://'

type OnboardAction = 'status' | 'onboard'

interface ProfileRow {
    stripe_connect_account_id: string | null
    stripe_connect_onboarded: boolean | null
}

const getAccountStatus = async (accountId: string) => {
    const account = await stripe.accounts.retrieve(accountId)
    const onboarded = Boolean(account.details_submitted && account.charges_enabled)
    return {
        account,
        onboarded,
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        requirements_currently_due: account.requirements?.currently_due ?? [],
        requirements_past_due: account.requirements?.past_due ?? [],
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization') || ''
        if (!authHeader.startsWith('Bearer ')) {
            return errorResponse('Missing authorization', 401)
        }

        const userClient = getSupabaseUserClient(authHeader)
        const { data: userData, error: userErr } = await userClient.auth.getUser()
        if (userErr || !userData?.user) {
            return errorResponse('Invalid session', 401)
        }

        const userId = userData.user.id
        const email = userData.user.email || undefined
        const body = await req.json().catch(() => ({}))
        const action: OnboardAction = body?.action === 'status' ? 'status' : 'onboard'

        const admin = getSupabaseAdmin()
        const { data: profile } = await admin
            .from('profiles')
            .select('stripe_connect_account_id, stripe_connect_onboarded')
            .eq('id', userId)
            .single<ProfileRow>()

        let accountId = profile?.stripe_connect_account_id ?? null

        if (action === 'status') {
            if (!accountId) {
                return successResponse({
                    account_id: null,
                    onboarded: false,
                    charges_enabled: false,
                    payouts_enabled: false,
                    requirements_currently_due: [],
                    requirements_past_due: [],
                })
            }

            const status = await getAccountStatus(accountId)

            if (status.onboarded !== Boolean(profile?.stripe_connect_onboarded)) {
                await admin
                    .from('profiles')
                    .update({ stripe_connect_onboarded: status.onboarded })
                    .eq('id', userId)
            }

            return successResponse({
                account_id: accountId,
                onboarded: status.onboarded,
                charges_enabled: status.charges_enabled,
                payouts_enabled: status.payouts_enabled,
                requirements_currently_due: status.requirements_currently_due,
                requirements_past_due: status.requirements_past_due,
            })
        }

        if (!accountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'PL',
                email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: 'individual',
                metadata: { supabase_uid: userId },
            })
            accountId = account.id

            await admin
                .from('profiles')
                .update({ stripe_connect_account_id: accountId })
                .eq('id', userId)
        }

        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${APP_URL_SCHEME}profile/stripe-connect?refresh=1`,
            return_url: `${APP_URL_SCHEME}profile/stripe-connect?return=1`,
            type: 'account_onboarding',
        })

        return successResponse({
            onboarding_url: accountLink.url,
            account_id: accountId,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('stripe-connect-onboard error:', message)
        return errorResponse(message)
    }
})
