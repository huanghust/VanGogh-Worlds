import {
  mysqlTable,
  varchar,
  double,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

// live player presence — one row per online visitor, refreshed by heartbeat
export const presence = mysqlTable("presence", {
  id: varchar("id", { length: 64 }).primaryKey(),
  x: double("x").notNull(),
  y: double("y").notNull(),
  z: double("z").notNull(),
  yaw: double("yaw").notNull(),
  map: varchar("map", { length: 16 }).notNull().default("wheatfield"), // which painting the player is inside
  sitting: boolean("sitting").notNull().default(false),
  bubble: varchar("bubble", { length: 280 }),
  bubbleAt: bigint("bubble_at", { mode: "number" }),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
