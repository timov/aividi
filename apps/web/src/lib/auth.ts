import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * One shared password for the internal admin, held as an HMAC in a cookie.
 *
 * Deliberately checked in the layout AND in every server action: a server
 * action is its own endpoint, and a layout check does not protect it. Anything
 * that writes calls requireAdmin() first.
 */

const COOKIE = 'aividi_admin'

export function adminToken(): string {
  const secret = process.env.ADMIN_SECRET
  const password = process.env.ADMIN_PASSWORD
  if (!secret || !password) {
    throw new Error('ADMIN_SECRET and ADMIN_PASSWORD must be set - see .env.example')
  }
  return createHmac('sha256', secret).update(password).digest('hex')
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? ''
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value
  if (!value) return false
  try {
    const a = Buffer.from(value)
    const b = Buffer.from(adminToken())
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/login')
}

export async function signIn(): Promise<void> {
  ;(await cookies()).set(COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function signOut(): Promise<void> {
  ;(await cookies()).delete(COOKIE)
}

/** Stamped onto verified_by / decided_by so the audit trail names someone. */
export const ADMIN_ACTOR = 'admin'
