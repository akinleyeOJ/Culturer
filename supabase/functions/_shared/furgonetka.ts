// Shared Furgonetka REST client + CORS + auth helpers used by the
// furgonetka-* Edge Functions. Keep this file free of Supabase-specific
// logic so it stays unit-testable.

export const FURGONETKA_API_BASE = 'https://api.furgonetka.pl'

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const jsonResponse = (
    body: unknown,
    init: ResponseInit = { status: 200 },
) =>
    new Response(JSON.stringify(body), {
        ...init,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(init.headers || {}) },
    })

export const successResponse = (body: Record<string, unknown>) =>
    jsonResponse({ success: true, ...body })

export const errorResponse = (message: string, status = 200) =>
    jsonResponse({ success: false, error: message }, { status })

export const getFurgonetkaToken = (): string => {
    const token = Deno.env.get('FURGONETKA_API_TOKEN') || ''
    if (!token) {
        throw new Error('FURGONETKA_API_TOKEN is not configured')
    }
    return token
}

export const buildFurgonetkaHeaders = (): HeadersInit => ({
    Authorization: `Bearer ${getFurgonetkaToken()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
})

export interface FurgonetkaRequestOptions {
    path: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: Record<string, unknown>
    query?: Record<string, string | number | boolean | undefined>
}

export async function callFurgonetka<T = unknown>({
    path,
    method = 'GET',
    body,
    query,
}: FurgonetkaRequestOptions): Promise<T> {
    const url = new URL(path, FURGONETKA_API_BASE)
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) url.searchParams.set(key, String(value))
        }
    }

    const response = await fetch(url.toString(), {
        method,
        headers: buildFurgonetkaHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
        const message =
            (payload as { message?: string })?.message ||
            (payload as { error?: string })?.error ||
            `Furgonetka request failed (${response.status})`
        throw new Error(message)
    }

    return payload as T
}
