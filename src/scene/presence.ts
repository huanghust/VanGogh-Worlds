// stable anonymous player id — no login, no names (friendship system comes later)
export function getPlayerId(): string {
  let id = localStorage.getItem('wheatfield-player-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('wheatfield-player-id', id)
  }
  return id
}

export type PresenceState = { x: number; y: number; z: number; yaw: number }

export type RemotePlayer = {
  id: string
  x: number
  y: number
  z: number
  yaw: number
  bubble: string | null
  bubbleAt: number | null
  updatedAt: number // server heartbeat time — handholding uses it to spot a ghost guide
  sitting: boolean // perched on a fence post / shrub (folded wings)
}

// presence API — tRPC *queries* called over plain GET, the only channel the
// preview edge lets through (POST is dropped, non-/api/trpc paths are 403)
async function trpcGet<T>(proc: string, input: unknown): Promise<T> {
  const q = encodeURIComponent(JSON.stringify({ json: input }))
  const r = await fetch(`/api/trpc/${proc}?input=${q}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`server ${r.status}`)
  const data = await r.json()
  const result = data?.result?.data
  if (result === undefined || data?.error) throw new Error('bad response')
  return result.json as T
}

export async function apiHeartbeat(id: string, p: PresenceState, map: string, sitting = false): Promise<void> {
  await trpcGet('presence.heartbeat', {
    id,
    x: Number(p.x.toFixed(2)),
    y: Number(p.y.toFixed(2)),
    z: Number(p.z.toFixed(2)),
    sitting,
    yaw: Number(p.yaw.toFixed(3)),
    map,
  })
}

export async function apiSay(
  id: string,
  bubble: string
): Promise<{ ok: boolean; blocked: boolean; limited: boolean }> {
  return trpcGet('presence.say', { id, bubble })
}

export async function apiList(id: string, map: string): Promise<RemotePlayer[]> {
  return trpcGet('presence.list', { id, map })
}

// ---- friendship API ------------------------------------------------------

export type FriendEntry = { id: string; name: string; online?: boolean; map?: string | null }
export type FriendPollResult = {
  incoming: { from: string; at: number }[]
  accepted: { with: string; name: string }[]
  friends: FriendEntry[]
  incomingLead: { from: string; at: number }[]
  leadAccepted: { with: string; role: 'leader' | 'led' }[]
  lead: { leading: string | null; ledBy: string | null } | null
  leadMap: string | null // partner's current painting (for following across maps)
}

export async function apiFriendReq(
  id: string,
  to: string
): Promise<{ ok: boolean; reason?: 'limited' | 'self' | 'friends' }> {
  return trpcGet('presence.friendRequest', { id, to })
}

export async function apiFriendAnswer(id: string, to: string, accept: boolean): Promise<{ ok: boolean }> {
  return trpcGet('presence.friendAnswer', { id, to, accept })
}

export async function apiFriendPoll(id: string): Promise<FriendPollResult> {
  return trpcGet('presence.friendPoll', { id })
}

export async function apiFriendName(
  id: string,
  friendId: string,
  name: string
): Promise<{ ok: boolean; blocked: boolean }> {
  return trpcGet('presence.friendName', { id, friendId, name })
}

// ---- handholding (lead) API ----------------------------------------------

export async function apiLeadReq(
  id: string,
  to: string
): Promise<{ ok: boolean; reason?: 'limited' | 'self' | 'notFriends' | 'linked' }> {
  return trpcGet('presence.leadRequest', { id, to })
}

export async function apiLeadAnswer(id: string, to: string, accept: boolean): Promise<{ ok: boolean }> {
  return trpcGet('presence.leadAnswer', { id, to, accept })
}

export async function apiLeadRelease(id: string): Promise<{ ok: boolean; other: string | null }> {
  return trpcGet('presence.leadRelease', { id })
}
