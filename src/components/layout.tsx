import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'

export function Layout() {
  return (
    <div className="flex min-h-svh">
      <AppSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
