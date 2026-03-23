'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Camera, UserPlus, BarChart3 } from 'lucide-react'

const links = [
  { href: '/', label: 'เช็คชื่อ', icon: Camera },
  { href: '/setup', label: 'ลงทะเบียน', icon: UserPlus },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
]

export default function NavMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={menuRef} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full shadow-md border border-gray-200 transition"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="absolute top-12 right-0 w-48 bg-white backdrop-blur-md border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition ${
                  active
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
          <div className="border-t border-gray-100 px-4 py-2">
            <span className="text-[10px] text-gray-300">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </div>
        </div>
      )}
    </div>
  )
}
