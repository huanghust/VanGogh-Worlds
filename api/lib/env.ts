import "dotenv/config";

// Nothing here is strictly required:
// - APP_ID / APP_SECRET are template leftovers, unused anywhere in the codebase
// - DATABASE_URL absent → presence runs in its designed in-memory mode
//   (see presenceCore.ts), which is exactly what a single-process deploy wants
function optional(name: string): string {
  return process.env[name] ?? "";
}

export const env = {
  appId: optional("APP_ID"),
  appSecret: optional("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: optional("DATABASE_URL"),
};
