import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Users,
  UserCog,
  X,
} from 'lucide-react'
import { useAuth, roleLabel } from '@/lib/auth'
import { useUnreadCount } from '@/hooks/use-scheduling'
import { ApiisLogo } from '@/components/apiis-logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

function initialsOf(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : '?'
}

/** 侧边栏一条导航项：当前路由高亮，点击后（移动端）关闭抽屉。 */
function SidebarNavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && (
        <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[10px] leading-none">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
    </NavLink>
  )
}

function SidebarContents({ onNavigate }: { onNavigate: () => void }) {
  const { profile, signOut } = useAuth()
  const { data: unread = 0 } = useUnreadCount()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  const obsNav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
    { to: '/feedback', label: 'Feedback', icon: MessageSquare },
  ]

  const adminNav: NavItem[] = [
    { to: '/admin/groups', label: 'Groups & Assignments', icon: Users },
    { to: '/admin/records', label: 'Records', icon: ClipboardList },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/obs', label: 'OBS', icon: UserCog },
    { to: '/admin/scheduling', label: 'Scheduling', icon: CalendarClock },
    { to: '/admin/history', label: 'History', icon: History },
    { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <ApiisLogo className="h-8 w-auto" />
        <div className="leading-tight">
          <p className="text-sidebar-foreground text-sm font-semibold">APIIS</p>
          <p className="text-sidebar-foreground/60 text-xs">OBS Portal</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5">
        {(isAdmin ? adminNav : obsNav).map((item) => (
          <SidebarNavLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-sidebar-border mt-auto border-t p-2.5">
        <div className="flex items-center gap-2 rounded-md px-1.5 py-2">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initialsOf(profile?.full_name ?? '')}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sidebar-foreground truncate text-sm font-medium">{profile?.full_name}</p>
            <Badge variant="secondary" className="mt-0.5 font-normal">
              {roleLabel(profile?.role)}
            </Badge>
          </div>
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          <NavLink
            to="/account"
            onClick={onNavigate}
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2.5 py-1.5 text-sm"
          >
            Account
          </NavLink>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2.5 py-1.5 text-left text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* 移动端顶部条：仅含汉堡按钮 + logo，其余功能都在侧边栏里 */}
      <div className="bg-sidebar border-sidebar-border sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <ApiisLogo className="h-7 w-auto" />
      </div>

      {/* 桌面端：常驻侧边栏 */}
      <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-64 shrink-0 border-r lg:block">
        <SidebarContents onNavigate={() => undefined} />
      </aside>

      {/* 移动端：抽屉 + 遮罩 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="bg-sidebar absolute inset-y-0 left-0 w-72 shadow-xl">
            <div className="absolute top-3 right-3">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </Button>
            </div>
            <SidebarContents onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
