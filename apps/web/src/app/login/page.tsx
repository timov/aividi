import { redirect } from 'next/navigation'
import '../admin.css'
import { checkPassword, isAdmin, signIn } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function login(formData: FormData) {
  'use server'
  const password = String(formData.get('password') ?? '')
  if (!checkPassword(password)) redirect('/login?error=1')
  await signIn()
  redirect('/admin')
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await isAdmin()) redirect('/admin')
  const { error } = await searchParams

  return (
    <main className="login panel">
      <h1>
        aividi<span style={{ color: 'var(--accent)' }}>.</span>mk
      </h1>
      <p className="sub">Внатрешна алатка</p>
      <form action={login} className="stack">
        <input
          type="password"
          name="password"
          placeholder="Лозинка"
          autoFocus
          autoComplete="current-password"
          required
        />
        {error ? <p style={{ color: 'var(--accent)', margin: 0 }}>Погрешна лозинка.</p> : null}
        <button type="submit" className="primary">
          Најави се
        </button>
      </form>
    </main>
  )
}
