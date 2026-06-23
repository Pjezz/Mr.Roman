import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ThemeProvider from '@/components/shared/ThemeProvider'
import Sidebar from '@/components/shared/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <ThemeProvider>
      <div style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}>
        <Sidebar user={profile} />
        <main style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}