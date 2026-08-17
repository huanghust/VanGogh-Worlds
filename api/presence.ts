import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  heartbeatCore,
  sayCore,
  listCore,
  friendReqCore,
  friendAnswerCore,
  friendPollCore,
  friendNameCore,
  leadReqCore,
  leadAnswerCore,
  leadReleaseCore,
  clientIp,
} from "./presenceCore";

// IMPORTANT: heartbeat and say are defined as tRPC *queries* (not mutations)
// even though they write — tRPC queries are served over GET, and the preview
// edge only allows GET through /api/trpc/* (POST is dropped, custom paths 403).

const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/);
const coord = z.number().finite().min(-200).max(200);
const mapSchema = z.enum(["wheatfield", "auvers", "crowfield"]);

const heartbeatInput = z.object({
  id: idSchema,
  x: coord,
  y: z.number().finite().min(-50).max(100),
  z: coord,
  yaw: z.number().finite().min(-100).max(100),
  map: mapSchema,
  sitting: z.boolean().optional(), // perched on a fence post / shrub
});

export const presenceRouter = createRouter({
  heartbeat: publicQuery
    .input(heartbeatInput)
    .query(({ input, ctx }) => heartbeatCore(input, clientIp(ctx.req))),

  say: publicQuery
    .input(z.object({ id: idSchema, bubble: z.string().min(1).max(280) }))
    .query(({ input, ctx }) => sayCore(input, clientIp(ctx.req))),

  list: publicQuery
    .input(z.object({ id: idSchema, map: mapSchema }))
    .query(({ input }) => listCore(input.id, input.map)),

  friendRequest: publicQuery
    .input(z.object({ id: idSchema, to: idSchema }))
    .query(({ input, ctx }) => friendReqCore(input, clientIp(ctx.req))),

  friendAnswer: publicQuery
    .input(z.object({ id: idSchema, to: idSchema, accept: z.boolean() }))
    .query(({ input, ctx }) => friendAnswerCore(input, clientIp(ctx.req))),

  friendPoll: publicQuery
    .input(z.object({ id: idSchema }))
    .query(({ input, ctx }) => friendPollCore(input.id, clientIp(ctx.req))),

  friendName: publicQuery
    .input(z.object({ id: idSchema, friendId: idSchema, name: z.string().max(64) }))
    .query(({ input, ctx }) => friendNameCore(input, clientIp(ctx.req))),

  leadRequest: publicQuery
    .input(z.object({ id: idSchema, to: idSchema }))
    .query(({ input, ctx }) => leadReqCore(input, clientIp(ctx.req))),

  leadAnswer: publicQuery
    .input(z.object({ id: idSchema, to: idSchema, accept: z.boolean() }))
    .query(({ input, ctx }) => leadAnswerCore(input, clientIp(ctx.req))),

  leadRelease: publicQuery
    .input(z.object({ id: idSchema }))
    .query(({ input, ctx }) => leadReleaseCore(input, clientIp(ctx.req))),
});

