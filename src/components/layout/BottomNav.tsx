import { Home, Timer, User } from "lucide-react"
import { NavLink } from "react-router-dom"
import type { ThemeMode } from "../../types/social"

interface BottomNavProps {
  readonly theme: ThemeMode
}

const navItems = [
  { to: "/feed", icon: Home, label: "Beranda" },
  { to: "/timer", icon: Timer, label: "Waktu" },
  { to: "#profile", icon: User, label: "Profil" },
] as const

export function BottomNav({ theme }: BottomNavProps) {
  const isDark = theme === "dark"

  const bg = isDark
    ? "bg-[#27262f]/95 backdrop-blur-2xl border-t border-white/8"
    : "bg-white/95 backdrop-blur-2xl border-t border-ink/8"
  const activeColor = isDark ? "text-white" : "text-ink"
  const inactiveColor = isDark ? "text-white/35" : "text-ink/35"

  return (
    <nav className={`bottom-nav ${bg}`} style={{ height: 60 }}>
      {navItems.map(({ to, icon: Icon, label }) => (
        to === "/timer" ? (
          <button
            key={to}
            className={`relative flex-1 flex flex-col items-center justify-center gap-[3px] min-h-[60px] transition-colors ${inactiveColor}`}
            onClick={() => window.dispatchEvent(new Event("timeropen"))}
            type="button"
          >
            <Icon size={23} strokeWidth={1.6} />
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
          </button>
        ) : (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center justify-center gap-[3px] min-h-[60px] transition-colors ${isActive ? activeColor : inactiveColor}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className={`
                      absolute top-0 left-1/2 -translate-x-1/2
                      h-0.5 w-6 rounded-full
                      ${isDark ? "bg-white" : "bg-violet"}
                    `}
                  />
                )}
                <Icon
                  fill={isActive ? "currentColor" : "none"}
                  size={23}
                  strokeWidth={isActive ? 2.3 : 1.6}
                />
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        )
      ))}
    </nav>
  )
}
