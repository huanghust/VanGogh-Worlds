import { useEffect, useRef } from 'react'
import { Feather, MapPin, Ban, Lock, Check, X, HeartHandshake } from 'lucide-react'
import type { LangKey } from './i18n'
import type { FriendEntry } from './scene/presence'

// Friend menu — slides in from the right when you tap another player's bird.
// The panel is one living wheat stalk drawn as a single SVG: grain crown on
// top, four ability nodes growing out of the stem (bottom → top: befriend,
// lead, locate, block), a golden thread winding between them, and THE friend
// this tree belongs to perched on a branch (one tree, one name).
// ~1/3 of the screen, ~50% transparent, no captions under the icons.

const slideStyle = `@keyframes friendSlideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`

const GOLD = '#e8c46a'
const GOLD_DIM = 'rgba(216,178,92,0.55)'
const CREAM = '#f5e6bd'

// node heights on the stalk (top → bottom: block, locate, lead, befriend —
// befriend sits lowest, closest to the hand)
const NODE_Y = { block: 170, locate: 285, lead: 400, befriend: 515 } as const
const CX = 110 // stalk center x

// a smooth S-curving stalk that passes exactly through every node point
function stalkPath(): string {
  const pts = [
    [CX, 648], [CX - 7, 570], [CX, NODE_Y.befriend], [CX + 8, 458],
    [CX, NODE_Y.lead], [CX - 8, 344], [CX, NODE_Y.locate], [CX + 8, 226],
    [CX, NODE_Y.block], [CX - 5, 122], [CX, 74],
  ]
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]
    const [px, py] = pts[i - 1]
    const my = (py + y) / 2
    d += ` C${px},${my} ${x},${my} ${x},${y}`
  }
  return d
}

// a second, thinner strand braiding around the main stalk along its whole
// length — this is what makes the icons feel woven into one living stem
function Braid() {
  let d = ''
  for (let y = 640; y >= 84; y -= 4) {
    const x = CX + Math.sin(y / 15) * 7.5
    d += `${d ? 'L' : 'M'}${x.toFixed(1)},${y}`
  }
  return <path d={d} stroke={GOLD_DIM} strokeWidth={1.1} fill="none" opacity={0.55} />
}

// wheat grain crown at the top of the stalk — big, brushy, Van Gogh gold
function Crown() {
  const grains: [number, number, number][] = [
    [0, 56, 0], [-12, 66, -24], [12, 66, 24], [-14, 80, -28], [14, 80, 28], [-8, 92, -16], [8, 92, 16], [0, 76, 0],
  ]
  return (
    <g>
      {grains.map(([x, y, r], i) => (
        <ellipse key={i} cx={CX + x} cy={y} rx={5.2} ry={13} transform={`rotate(${r} ${CX + x} ${y})`} fill={GOLD} opacity={0.92} />
      ))}
      {/* awns — the fine whiskers above the grains */}
      {[-22, -14, -7, 0, 7, 14, 22].map((dx, i) => (
        <path key={i} d={`M${CX + dx * 0.3},56 Q${CX + dx * 0.8},${36} ${CX + dx},${16}`} stroke={GOLD_DIM} strokeWidth={1} fill="none" />
      ))}
    </g>
  )
}

// a pair of leaves hugging the stem right under a node
function NodeLeaves({ y }: { y: number }) {
  return (
    <g fill={GOLD_DIM} opacity={0.8}>
      <path d={`M${CX},${y + 30} Q${CX - 20},${y + 24} ${CX - 30},${y + 10} Q${CX - 14},${y + 16} ${CX},${y + 22} Z`} />
      <path d={`M${CX},${y + 30} Q${CX + 20},${y + 24} ${CX + 30},${y + 10} Q${CX + 14},${y + 16} ${CX},${y + 22} Z`} />
    </g>
  )
}

type NodeKey = keyof typeof NODE_Y

function TreeNode({
  nodeKey,
  label,
  locked,
  dimmed,
  checked,
  onClick,
}: {
  nodeKey: NodeKey
  label: string
  locked?: boolean
  dimmed?: boolean
  checked?: boolean
  onClick: () => void
}) {
  const y = NODE_Y[nodeKey]
  const Icon = { block: Ban, locate: MapPin, lead: HeartHandshake, befriend: Feather }[nodeKey]
  const faint = locked || dimmed
  return (
    <g
      role="button"
      aria-label={label}
      onClick={onClick}
      style={{ cursor: faint ? 'default' : 'pointer', color: faint ? 'rgba(216,196,138,0.4)' : CREAM }}
    >
      <NodeLeaves y={y} />
      <circle
        cx={CX}
        cy={y}
        r={27}
        fill={faint ? 'rgba(10,16,38,0.55)' : 'rgba(245,230,189,0.12)'}
        stroke={faint ? 'rgba(245,230,189,0.25)' : 'rgba(245,230,189,0.75)'}
        strokeWidth={1.4}
      />
      {/* hover halo */}
      {!faint && (
        <circle cx={CX} cy={y} r={27} fill="transparent" stroke="transparent">
          <title>{label}</title>
        </circle>
      )}
      <g transform={`translate(${CX}, ${y})`} opacity={faint ? 0.55 : 1}>
        <Icon x={-11} y={-11} width={22} height={22} strokeWidth={1.6} />
      </g>
      {locked && (
        <g transform={`translate(${CX + 19}, ${y + 19})`} color="rgba(216,196,138,0.75)">
          <circle r={8.5} fill="#0d1530" stroke="rgba(245,230,189,0.35)" strokeWidth={1} />
          <Lock x={-5} y={-5} width={10} height={10} strokeWidth={2} />
        </g>
      )}
      {checked && (
        <g transform={`translate(${CX + 19}, ${y + 19})`} color={CREAM}>
          <circle r={8.5} fill="#0d1530" stroke="rgba(245,230,189,0.55)" strokeWidth={1} />
          <Check x={-5} y={-5} width={10} height={10} strokeWidth={2.5} />
        </g>
      )}
    </g>
  )
}

// a perched friend: the double-arc gull stroke from the reference sketch,
// sitting on a thin twig that sprouts from the stalk
function PerchedBird({ index, name, highlighted }: { index: number; name: string; highlighted: boolean }) {
  const side = index % 2 === 0 ? 1 : -1
  // twig heights sit between the node circles so nothing overlaps
  const y = [570, 457, 342, 227, 122, 98][index % 6]
  const tipX = CX + side * 46
  const tipY = y - 12
  const bright = highlighted ? 1 : 0.78
  return (
    <g>
      <path
        d={`M${CX},${y} C${CX + side * 14},${y - 5} ${CX + side * 28},${y - 8} ${tipX},${tipY}`}
        stroke={GOLD_DIM}
        strokeWidth={1.3}
        fill="none"
      />
      {/* the bird — two swept arcs, thicker at the shoulders */}
      <g transform={`translate(${tipX + side * 2}, ${tipY - 6}) scale(${side * 1.15}, 1.15)`} opacity={bright}>
        <path
          d="M-17,3 Q-8,-8 0,-1 Q8,-10 17,-2"
          stroke={highlighted ? GOLD : CREAM}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      </g>
      <text
        x={tipX + side * 14}
        y={tipY - 14}
        textAnchor={side === 1 ? 'start' : 'end'}
        fontSize={11}
        fill={highlighted ? GOLD : 'rgba(245,230,189,0.8)'}
        letterSpacing={0.5}
        style={{ fontFamily: 'serif' }}
      >
        {name}
      </text>
    </g>
  )
}

export function FriendMenu({
  t,
  label,
  isFriend,
  pendingOut,
  friends,
  targetId,
  leadLinked,
  leadPending,
  blocked,
  onClose,
  onBefriend,
  onLead,
  onLeadRelease,
  onLocked,
  onLocate,
  onBlock,
  onRename,
}: {
  t: (k: LangKey) => string
  label: string
  isFriend: boolean
  pendingOut: boolean
  friends: FriendEntry[]
  targetId: string
  leadLinked: boolean
  leadPending: boolean
  blocked?: boolean // in MY block list — their tree withers to one unblock button
  onClose: () => void
  onBefriend: () => void
  onLead: () => void
  onLeadRelease: () => void
  onLocked: () => void
  onLocate: () => void // map-pin: face them; again within 10s = offer warp
  onBlock: () => void // block ⇄ unblock (the same node both ways)
  onRename: () => void // feather again on a friend = rename them
}) {
  return (
    <>
      <style>{slideStyle}</style>
      {/* backdrop — clicking the open field closes the menu */}
      <div className="absolute inset-0 z-40" onClick={onClose} />
      <aside
        data-ui
        className="absolute bottom-0 right-0 top-0 z-50 flex flex-col items-center border-l border-[#f5e6bd]/25 bg-[#0d1530]/50 backdrop-blur-md"
        style={{ width: 'clamp(280px, 33vw, 440px)', animation: 'friendSlideIn 0.32s ease-out' }}
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-lg text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
        >
          ‹
        </button>
        <div className="mt-14 px-4 text-center">
          <p className="text-lg tracking-[0.15em] text-[#f5e6bd]">{label}</p>
          {pendingOut && !isFriend && <p className="mt-1 text-xs text-[#d8c48a]/60">{t('friendPending')}</p>}
        </div>

        {/* blocked: the tree withers to a single unblock button */}
        {blocked ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
            <button
              onClick={onBlock}
              aria-label={t('friendUnblock').replace('{name}', label)}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-[#f5e6bd]/50 bg-[#f5e6bd]/8 text-[#f5e6bd] transition-all hover:scale-105 hover:bg-[#f5e6bd]/15"
            >
              <Ban size={26} strokeWidth={1.6} />
            </button>
            <p className="text-center text-sm tracking-[0.12em] text-[#f5e6bd]/85">
              {t('friendUnblock').replace('{name}', label)}
            </p>
          </div>
        ) : (
        /* the friendship tree */
        <svg viewBox="0 0 220 660" className="mt-2 w-full flex-1" preserveAspectRatio="xMidYMax meet" aria-hidden={false}>
          <defs>
            <linearGradient id="stalkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.95} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          {/* main stalk + the braiding strand that weaves it together */}
          <path d={stalkPath()} stroke="url(#stalkGrad)" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Braid />

          <Crown />

          {/* one tree, one name — only THIS friend perches here */}
          {friends
            .filter((f) => f.id === targetId)
            .map((f, i) => (
              <PerchedBird key={f.id} index={i} name={f.name} highlighted />
            ))}

          {/* ability nodes — top: block … bottom: befriend */}
          <TreeNode nodeKey="block" label={t('friendNodeBlock')} onClick={onBlock} />
          <TreeNode
            nodeKey="locate"
            label={t('friendNodeLocate')}
            locked={!isFriend}
            onClick={isFriend ? onLocate : onLocked}
          />
          <TreeNode
            nodeKey="lead"
            label={t('leadNode')}
            locked={!isFriend}
            dimmed={leadPending && !leadLinked}
            checked={leadLinked}
            onClick={
              !isFriend ? onLocked : leadLinked ? onLeadRelease : leadPending ? () => {} : onLead
            }
          />
          <TreeNode
            nodeKey="befriend"
            label={t('friendNodeBefriend')}
            dimmed={pendingOut && !isFriend}
            checked={isFriend}
            onClick={isFriend ? onRename : pendingOut ? () => {} : onBefriend}
          />
        </svg>
        )}
      </aside>
    </>
  )
}

// yes/no confirm — reused for "Befriend this player?" (outgoing) and
// "A traveler wants to be your friend" (incoming)
export function FriendConfirm({
  t,
  text,
  onYes,
  onNo,
}: {
  t: (k: LangKey) => string
  text: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div data-ui className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 flex flex-col items-center rounded-3xl border border-[#f5e6bd]/40 bg-[#0d1530]/90 px-10 py-8">
        <Feather size={26} strokeWidth={1.5} className="mb-4 text-[#e8c46a]" />
        <p className="mb-7 max-w-xs text-center text-base leading-7 text-[#f5e6bd]">{text}</p>
        <div className="flex items-center gap-6">
          <button
            onClick={onYes}
            aria-label={t('friendYes')}
            title={t('friendYes')}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#f5e6bd] bg-[#f5e6bd]/15 text-[#f5e6bd] transition-all hover:scale-105 hover:bg-[#f5e6bd] hover:text-[#0d1530]"
          >
            <Check size={20} strokeWidth={2.2} />
          </button>
          <button
            onClick={onNo}
            aria-label={t('friendNo')}
            title={t('friendNo')}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-[#d8c48a]/70 transition-all hover:scale-105 hover:bg-[#f5e6bd]/10 hover:text-[#f5e6bd]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

// naming popup after a friendship forms — save now or "later" (random name stays)
export function FriendNaming({
  t,
  current,
  value,
  onChange,
  onSave,
  onLater,
}: {
  t: (k: LangKey) => string
  current: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onLater: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  return (
    <div data-ui className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-sm flex-col items-center rounded-3xl border border-[#f5e6bd]/40 bg-[#0d1530]/90 px-8 py-8">
        <Feather size={26} strokeWidth={1.5} className="mb-4 text-[#e8c46a]" />
        <p className="mb-5 text-center text-base tracking-[0.1em] text-[#f5e6bd]">{t('friendNameTitle')}</p>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') onSave()
            if (e.key === 'Escape') onLater()
          }}
          placeholder={current || t('friendNamePlaceholder')}
          maxLength={24}
          className="mb-6 w-full rounded-full border border-[#f5e6bd]/40 bg-white/5 px-5 py-2.5 text-center text-sm text-[#f5e6bd] placeholder-[#d8c48a]/40 outline-none focus:border-[#f5e6bd]"
        />
        <div className="flex items-center gap-4">
          <button
            onClick={onSave}
            className="rounded-full border border-[#f5e6bd] bg-[#f5e6bd]/15 px-6 py-2 text-sm text-[#f5e6bd] transition-all hover:bg-[#f5e6bd] hover:text-[#0d1530]"
          >
            {t('friendNameSave')}
          </button>
          <button
            onClick={onLater}
            className="rounded-full border border-[#f5e6bd]/30 px-6 py-2 text-sm text-[#d8c48a]/70 transition-all hover:bg-[#f5e6bd]/10 hover:text-[#f5e6bd]"
          >
            {t('friendNameLater')}
          </button>
        </div>
      </div>
    </div>
  )
}
