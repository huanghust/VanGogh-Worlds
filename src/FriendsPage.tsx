import { useEffect, useState } from 'react'
import { Bird } from 'lucide-react'
import { getPlayerId, apiFriendPoll, type FriendEntry } from './scene/presence'
import type { LangKey } from './i18n'

// little perched-bird line icon (bird on a branch) — shared by the perch
// button and the friends list avatars
export function PerchBirdIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* body: plump teardrop chest, head overlapping — one clean silhouette,
          back rises in a single unbroken curve (no shoulder hump) */}
      <circle cx="23" cy="29" r="7" />
      <circle cx="30" cy="20.5" r="4.5" />
      {/* beak */}
      <path d="M34 19.5l4.5 1.8-4.5 1.4" />
      {/* eye */}
      <circle cx="31" cy="19.5" r="0.4" fill="currentColor" />
      {/* tail feathers */}
      <path d="M16.5 26.5l-8-2.5M16.3 30.5l-8 1" />
      {/* legs */}
      <path d="M21 35.5v4.5M26 35.5v4.5" />
      {/* branch */}
      <path d="M6 40h36" />
    </svg>
  )
}

// friends page: every traveler you've befriended, online ones bright,
// offline ones grayed out and "flown off". Bird-featured, like the tree.
export function FriendsPage({
  t,
  onClose,
  onJoin,
}: {
  t: (k: LangKey) => string
  onClose: () => void
  onJoin?: (f: FriendEntry) => void // tap an online friend to fly to their painting
}) {
  const [friends, setFriends] = useState<FriendEntry[]>([])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const r = await apiFriendPoll(getPlayerId())
        if (alive) setFriends(r.friends)
      } catch {
        /* a missed poll just refreshes a beat later */
      }
    }
    tick()
    const i = window.setInterval(tick, 3000)
    return () => {
      alive = false
      window.clearInterval(i)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const online = friends.filter((f) => f.online)
  const offline = friends.filter((f) => !f.online)

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center bg-[#0d1530]/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-xl text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
        aria-label="back"
      >
        ‹
      </button>
      <div className="mb-2 mt-20 text-[#f5e6bd]">
        <Bird size={40} strokeWidth={1.6} />
      </div>
      <h2 className="mb-6 px-4 text-center text-xl tracking-[0.25em] text-[#f5e6bd]">{t('friendsTitle')}</h2>
      <div className="w-full max-w-md flex-1 overflow-y-auto px-6 pb-20">
        {friends.length === 0 && (
          <p className="mt-16 px-8 text-center text-sm leading-relaxed tracking-wider text-[#e8d9ae]/60">
            {t('friendsEmpty')}
          </p>
        )}
        {[...online, ...offline].map((f) => (
          <div
            key={f.id}
            onClick={f.online && f.map && onJoin ? () => onJoin(f) : undefined}
            role={f.online && f.map && onJoin ? 'button' : undefined}
            title={f.online && f.map ? t('friendJoinHint') : undefined}
            className={`mb-2 flex w-full items-center gap-4 rounded-2xl border px-5 py-3.5 transition-all ${
              f.online
                ? 'border-[#f5e6bd]/35 bg-[#f5e6bd]/5 text-[#f5e6bd] hover:border-[#f5e6bd]/70 hover:bg-[#f5e6bd]/15' +
                  (f.map && onJoin ? ' cursor-pointer' : '')
                : 'border-[#f5e6bd]/10 text-[#e8d9ae]/45'
            }`}
            style={f.online ? undefined : { filter: 'grayscale(0.7)' }}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                f.online ? 'border-[#f5e6bd]/45 bg-[#f5e6bd]/10' : 'border-[#f5e6bd]/15'
              }`}
            >
              <Bird size={22} strokeWidth={1.6} />
            </span>
            <span className="flex-1 truncate font-serif tracking-wider">{f.name}</span>
            <span className="flex items-center gap-1.5 text-xs tracking-widest">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  f.online ? 'bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.9)]' : 'bg-[#e8d9ae]/30'
                }`}
              />
              {f.online ? t('friendOnline') : t('friendOffline')}
            </span>
            {f.online && f.map && onJoin && <span className="text-[#f5e6bd]/60">→</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
