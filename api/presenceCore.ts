import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
import { presence } from "@db/schema";
import { isOffensive } from "./moderation";

const STALE_MS = 12000; // a player is "online" if seen within the last 12s
const DELETE_MS = 45000; // rows older than this are removed

// ---- dev fallback: no DATABASE_URL locally -------------------------------
// The hosted MySQL only exists in the published environment; local dev has no
// DATABASE_URL at all. Presence is ephemeral by design (stale after 12s, gone
// after 45s), so an in-memory store is an honest stand-in for local testing —
// including chat bubbles and seeing other players on the same dev server.
type PresenceRow = {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  map: string;
  sitting: boolean;
  bubble: string | null;
  bubbleAt: number | null;
  updatedAt: number;
};
const useMemory = !env.databaseUrl;
const memRows = new Map<string, PresenceRow>();
function memCleanup(now: number) {
  for (const [k, v] of memRows) if (v.updatedAt < now - DELETE_MS) memRows.delete(k);
}

// ---- lightweight abuse protection -------------------------------------
const hits = new Map<string, number[]>();
const idsPerIp = new Map<string, Map<string, number>>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      const f = v.filter((t) => now - t < 60000);
      if (f.length === 0) hits.delete(k);
      else hits.set(k, f);
    }
  }
  return true;
}

function allowIdForIp(ip: string, id: string, maxIds: number): boolean {
  const now = Date.now();
  let m = idsPerIp.get(ip);
  if (!m) {
    m = new Map();
    idsPerIp.set(ip, m);
  }
  for (const [k, t] of m) if (now - t > STALE_MS) m.delete(k);
  m.set(id, now);
  return m.size <= maxIds;
}

// ---- core presence logic (shared by the tRPC router and the GET routes) --

export type HeartbeatInput = { id: string; x: number; y: number; z: number; yaw: number; map: string; sitting?: boolean };

export async function heartbeatCore(input: HeartbeatInput, ip: string) {
  if (!allow(`hb:${ip}:${input.id}`, 5, 2000)) return { ok: false as const };
  if (!allowIdForIp(ip, input.id, 20)) return { ok: false as const };

  const now = Date.now();
  lastSeen.set(input.id, now); // handholding: freshness source for auto-release

  if (useMemory) {
    const prev = memRows.get(input.id);
    memRows.set(input.id, {
      id: input.id,
      x: input.x,
      y: input.y,
      z: input.z,
      yaw: input.yaw,
      map: input.map,
      sitting: input.sitting ?? prev?.sitting ?? false,
      bubble: prev?.bubble ?? null,
      bubbleAt: prev?.bubbleAt ?? null,
      updatedAt: now,
    });
    memCleanup(now);
    return { ok: true as const };
  }

  const db = getDb();

  const existing = await db
    .select({ id: presence.id })
    .from(presence)
    .where(eq(presence.id, input.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(presence).values({
      id: input.id,
      x: input.x,
      y: input.y,
      z: input.z,
      yaw: input.yaw,
      map: input.map,
      sitting: input.sitting ?? false,
      updatedAt: now,
    });
  } else {
    await db
      .update(presence)
      .set({ x: input.x, y: input.y, z: input.z, yaw: input.yaw, map: input.map, ...(input.sitting !== undefined ? { sitting: input.sitting } : {}), updatedAt: now })
      .where(eq(presence.id, input.id));
  }

  await db.delete(presence).where(lt(presence.updatedAt, now - DELETE_MS));

  return { ok: true as const };
}

export async function sayCore(input: { id: string; bubble: string }, ip: string) {
  if (!allow(`say:${ip}:${input.id}`, 3, 10000)) {
    return { ok: false as const, blocked: false as const, limited: true as const };
  }
  if (isOffensive(input.bubble)) {
    return { ok: false as const, blocked: true as const, limited: false as const };
  }
  const now = Date.now();

  if (useMemory) {
    const prev = memRows.get(input.id);
    memRows.set(input.id, {
      id: input.id,
      x: prev?.x ?? 0,
      y: prev?.y ?? 0,
      z: prev?.z ?? 0,
      yaw: prev?.yaw ?? 0,
      map: prev?.map ?? "wheatfield",
      sitting: prev?.sitting ?? false,
      bubble: input.bubble,
      bubbleAt: now,
      updatedAt: now,
    });
    return { ok: true as const, blocked: false as const, limited: false as const };
  }

  const db = getDb();
  const existing = await db
    .select({ id: presence.id })
    .from(presence)
    .where(eq(presence.id, input.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(presence).values({
      id: input.id,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      bubble: input.bubble,
      bubbleAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(presence)
      .set({ bubble: input.bubble, bubbleAt: now, updatedAt: now })
      .where(eq(presence.id, input.id));
  }
  return { ok: true as const, blocked: false as const, limited: false as const };
}

// ---- friendships ---------------------------------------------------------
// Session-level by design: kept in memory even when MySQL is configured.
// Friendships die with the server process (and with the preview deploy), and
// pending requests expire after 60s — nothing here is meant to outlive a play
// session. Persistent accounts/friends would need real login first.
//
// The state hangs off globalThis because the vite dev server reloads API
// modules while a page is connected (presence rows survive this silently —
// heartbeats refill them every 0.9s — but pending friend requests were being
// wiped mid-handshake). Production is one long-lived process; the global is
// simply shared there too.
type PendingReq = { from: string; at: number };
type FriendState = {
  // target id -> requests waiting for that player's answer
  pendingReqs: Map<string, PendingReq[]>;
  // owner id -> (friend id -> the name the owner calls them)
  friendships: Map<string, Map<string, { name: string; since: number }>>;
  // player id -> one-shot "your request was accepted" events, delivered once
  acceptedEvents: Map<string, { with: string; name: string }[]>;
  // ---- handholding (lead) ----
  // target id -> lead requests waiting for that player's answer
  pendingLeads: Map<string, PendingReq[]>;
  // leader id -> the traveler they are guiding (one lead each way at a time)
  leads: Map<string, string>;
  // player id -> one-shot "your lead request was accepted" events
  leadEvents: Map<string, { with: string; role: 'leader' | 'led' }[]>;
  // player id -> last heartbeat time — stale partners auto-release the hold
  lastSeen: Map<string, number>;
};
const friendState: FriendState = ((globalThis as { __wheatfieldFriends?: FriendState })
  .__wheatfieldFriends ??= {
  pendingReqs: new Map(),
  friendships: new Map(),
  acceptedEvents: new Map(),
  pendingLeads: new Map(),
  leads: new Map(),
  leadEvents: new Map(),
  lastSeen: new Map(),
});
// older global objects (pre-lead reloads) may miss the new maps — backfill
friendState.pendingLeads ??= new Map();
friendState.leads ??= new Map();
friendState.leadEvents ??= new Map();
friendState.lastSeen ??= new Map();
const { pendingReqs, friendships, acceptedEvents, pendingLeads, leads, leadEvents, lastSeen } = friendState;
const FRIEND_REQ_TTL_MS = 60000;

const NAME_ADJ = ["Amber", "Golden", "Quiet", "Swift", "Little", "Wandering", "Misty", "Crimson"];
const NAME_BIRD = ["Lark", "Sparrow", "Finch", "Wren", "Starling", "Swift"];
function randomBirdName(): string {
  const a = NAME_ADJ[Math.floor(Math.random() * NAME_ADJ.length)];
  const b = NAME_BIRD[Math.floor(Math.random() * NAME_BIRD.length)];
  return `${a} ${b}`;
}

function prunePending(now: number) {
  for (const [to, arr] of pendingReqs) {
    const fresh = arr.filter((r) => now - r.at < FRIEND_REQ_TTL_MS);
    if (fresh.length === 0) pendingReqs.delete(to);
    else pendingReqs.set(to, fresh);
  }
}

export function areFriends(a: string, b: string): boolean {
  return friendships.get(a)?.has(b) ?? false;
}

export async function friendReqCore(input: { id: string; to: string }, ip: string) {
  if (!allow(`freq:${ip}:${input.id}`, 5, 60000)) {
    return { ok: false as const, reason: "limited" as const };
  }
  if (input.id === input.to) return { ok: false as const, reason: "self" as const };
  if (areFriends(input.id, input.to)) return { ok: false as const, reason: "friends" as const };

  const now = Date.now();
  prunePending(now);
  const arr = pendingReqs.get(input.to) ?? [];
  const existing = arr.find((r) => r.from === input.id);
  if (existing) existing.at = now; // re-sending just refreshes, no spam
  else arr.push({ from: input.id, at: now });
  pendingReqs.set(input.to, arr);
  return { ok: true as const };
}

export async function friendAnswerCore(input: { id: string; to: string; accept: boolean }, ip: string) {
  if (!allow(`fans:${ip}:${input.id}`, 10, 60000)) return { ok: false as const };

  const now = Date.now();
  prunePending(now);
  // input.id answers the request that input.to sent them
  const arr = pendingReqs.get(input.id) ?? [];
  const idx = arr.findIndex((r) => r.from === input.to);
  if (idx === -1) return { ok: false as const }; // nothing pending (expired / never sent)
  arr.splice(idx, 1);
  if (arr.length === 0) pendingReqs.delete(input.id);

  if (!input.accept) return { ok: true as const }; // silent decline — requester is never told

  for (const [owner, other] of [
    [input.id, input.to],
    [input.to, input.id],
  ] as const) {
    let mine = friendships.get(owner);
    if (!mine) {
      mine = new Map();
      friendships.set(owner, mine);
    }
    if (!mine.has(other)) {
      const name = randomBirdName();
      mine.set(other, { name, since: now });
      const ev = acceptedEvents.get(owner) ?? [];
      ev.push({ with: other, name });
      acceptedEvents.set(owner, ev);
    }
  }
  return { ok: true as const };
}

export async function friendPollCore(id: string, ip: string) {
  if (!allow(`fpoll:${ip}:${id}`, 90, 60000)) {
    return { incoming: [], accepted: [], friends: [], incomingLead: [], leadAccepted: [], lead: null, leadMap: null };
  }
  const now = Date.now();
  prunePending(now);
  prunePendingLeads(now);
  pruneStaleLeads(now);
  const incoming = (pendingReqs.get(id) ?? []).map((r) => ({ from: r.from, at: r.at }));
  const accepted = acceptedEvents.get(id) ?? [];
  acceptedEvents.delete(id); // one-shot delivery
  const friendIds = [...(friendships.get(id)?.keys() ?? [])];
  // each friend's current painting (null when offline) — powers "join them"
  const friendMaps = new Map<string, string>();
  if (friendIds.length > 0) {
    if (useMemory) {
      for (const fid of friendIds) {
        const row = memRows.get(fid);
        if (row && row.updatedAt > now - STALE_MS) friendMaps.set(fid, row.map);
      }
    } else {
      const rows = await getDb()
        .select({ id: presence.id, map: presence.map })
        .from(presence)
        .where(and(inArray(presence.id, friendIds), gt(presence.updatedAt, now - STALE_MS)));
      for (const r of rows) friendMaps.set(r.id, r.map);
    }
  }
  const friends = friendIds.map((fid) => ({
    id: fid,
    name: friendships.get(id)!.get(fid)!.name,
    online: now - (lastSeen.get(fid) ?? 0) < STALE_MS,
    map: friendMaps.get(fid) ?? null,
  }));
  const incomingLead = (pendingLeads.get(id) ?? []).map((r) => ({ from: r.from, at: r.at }));
  const leadAccepted = leadEvents.get(id) ?? [];
  leadEvents.delete(id); // one-shot delivery
  const leading = leads.get(id) ?? null;
  const ledBy = [...leads.entries()].find(([, led]) => led === id)?.[0] ?? null;
  const lead = leading || ledBy ? { leading, ledBy } : null;
  // handholding: the partner's current painting, so a led player can follow
  // their guide across map switches
  const partnerId = leading ?? ledBy;
  let leadMap: string | null = null;
  if (partnerId) {
    if (useMemory) {
      leadMap = memRows.get(partnerId)?.map ?? null;
    } else {
      const rows = await getDb()
        .select({ map: presence.map })
        .from(presence)
        .where(eq(presence.id, partnerId))
        .limit(1);
      leadMap = rows[0]?.map ?? null;
    }
  }
  return { incoming, accepted, friends, incomingLead, leadAccepted, lead, leadMap };
}

export async function friendNameCore(input: { id: string; friendId: string; name: string }, ip: string) {
  if (!allow(`fname:${ip}:${input.id}`, 10, 60000)) {
    return { ok: false as const, blocked: false as const };
  }
  const name = input.name.trim().slice(0, 24);
  if (!name || isOffensive(name)) return { ok: false as const, blocked: true as const };
  const mine = friendships.get(input.id);
  const entry = mine?.get(input.friendId);
  if (!entry) return { ok: false as const, blocked: false as const };
  entry.name = name;
  return { ok: true as const, blocked: false as const };
}

// ---- handholding (lead) --------------------------------------------------
// The requester offers to LEAD the target; if the target accepts, the pair
// is linked until either lets go. Requires friendship first (mirrors the
// tree's bottom-up unlock: befriend → lead → music/locate).

function prunePendingLeads(now: number) {
  for (const [to, arr] of pendingLeads) {
    const fresh = arr.filter((r) => now - r.at < FRIEND_REQ_TTL_MS);
    if (fresh.length === 0) pendingLeads.delete(to);
    else pendingLeads.set(to, fresh);
  }
}

// a lead whose partner went quiet (closed the tab without letting go) releases
// itself — otherwise the follower would stay slaved to a ghost
function pruneStaleLeads(now: number) {
  for (const [leader, led] of leads) {
    const leaderGone = now - (lastSeen.get(leader) ?? 0) > STALE_MS;
    const ledGone = now - (lastSeen.get(led) ?? 0) > STALE_MS;
    if (leaderGone || ledGone) leads.delete(leader);
  }
}

function unlinkLead(id: string): string | null {
  const led = leads.get(id);
  if (led) {
    leads.delete(id);
    return led;
  }
  // if this player is being led by someone, cut that link too
  for (const [leader, l] of leads) {
    if (l === id) {
      leads.delete(leader);
      return leader;
    }
  }
  return null;
}

export async function leadReqCore(input: { id: string; to: string }, ip: string) {
  if (!allow(`lreq:${ip}:${input.id}`, 5, 60000)) {
    return { ok: false as const, reason: "limited" as const };
  }
  if (input.id === input.to) return { ok: false as const, reason: "self" as const };
  if (!areFriends(input.id, input.to)) return { ok: false as const, reason: "notFriends" as const };
  if (leads.get(input.id) === input.to) return { ok: false as const, reason: "linked" as const };

  const now = Date.now();
  prunePendingLeads(now);
  const arr = pendingLeads.get(input.to) ?? [];
  const existing = arr.find((r) => r.from === input.id);
  if (existing) existing.at = now;
  else arr.push({ from: input.id, at: now });
  pendingLeads.set(input.to, arr);
  return { ok: true as const };
}

export async function leadAnswerCore(input: { id: string; to: string; accept: boolean }, ip: string) {
  if (!allow(`lans:${ip}:${input.id}`, 10, 60000)) return { ok: false as const };

  const now = Date.now();
  prunePendingLeads(now);
  // input.id answers the lead request that input.to sent them
  const arr = pendingLeads.get(input.id) ?? [];
  const idx = arr.findIndex((r) => r.from === input.to);
  if (idx === -1) return { ok: false as const };
  arr.splice(idx, 1);
  if (arr.length === 0) pendingLeads.delete(input.id);

  if (!input.accept) return { ok: true as const }; // silent decline

  // a fresh link replaces any either side already has
  unlinkLead(input.to);
  unlinkLead(input.id);
  leads.set(input.to, input.id); // requester leads, answerer is led
  const evA = leadEvents.get(input.id) ?? [];
  evA.push({ with: input.to, role: "led" });
  leadEvents.set(input.id, evA);
  const evB = leadEvents.get(input.to) ?? [];
  evB.push({ with: input.id, role: "leader" });
  leadEvents.set(input.to, evB);
  return { ok: true as const };
}

export async function leadReleaseCore(input: { id: string }, ip: string) {
  if (!allow(`lrel:${ip}:${input.id}`, 10, 60000)) return { ok: false as const, other: null };
  return { ok: true as const, other: unlinkLead(input.id) };
}

// warp: landing at a friend's side means landing in their hand — the warper
// arrives as the LED one, the friend guides. Direct link, no handshake: the
// client's two-step locate → confirm IS the consent.
export async function warpLeadCore(input: { id: string; to: string }, ip: string) {
  if (!allow(`warp:${ip}:${input.id}`, 5, 60000)) return { ok: false as const, reason: "limited" as const };
  if (input.id === input.to) return { ok: false as const, reason: "self" as const };
  if (!areFriends(input.id, input.to)) return { ok: false as const, reason: "notFriends" as const };
  unlinkLead(input.id);
  unlinkLead(input.to);
  leads.set(input.to, input.id); // the friend leads, the warper is led
  const evA = leadEvents.get(input.id) ?? [];
  evA.push({ with: input.to, role: "led" as const });
  leadEvents.set(input.id, evA);
  const evB = leadEvents.get(input.to) ?? [];
  evB.push({ with: input.id, role: "leader" as const });
  leadEvents.set(input.to, evB);
  return { ok: true as const };
}

// players only share a painting with players inside the same painting
export async function listCore(id: string, map: string) {
  const now = Date.now();

  if (useMemory) {
    memCleanup(now);
    return [...memRows.values()].filter(
      (r) => r.updatedAt > now - STALE_MS && r.id !== id && r.map === map
    );
  }

  const db = getDb();
  return db
    .select()
    .from(presence)
    .where(and(gt(presence.updatedAt, now - STALE_MS), ne(presence.id, id), eq(presence.map, map)));
}
