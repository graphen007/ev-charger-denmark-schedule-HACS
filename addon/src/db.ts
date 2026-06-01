import { MongoClient, type Collection, type Db } from "mongodb";
import type { ChargingSession, GlobalSettings, LastCommand } from "./settings.js";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const DB_NAME     = "ev_charging";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<void> {
  if (client) return;
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection("sessions").createIndex({ carId: 1, startTime: -1 });
  console.log(`[DB] Connected to MongoDB at ${MONGODB_URI}`);
}

function col<T extends object>(name: string): Collection<T> {
  if (!db) throw new Error("MongoDB not connected");
  return db.collection<T>(name);
}

export function isDbConnected(): boolean { return db !== null; }

// ---- Sessions ----

export async function dbLoadSessions(): Promise<ChargingSession[]> {
  const docs = await col<ChargingSession>("sessions")
    .find({}, { sort: { startTime: 1 }, limit: 500, projection: { _id: 0 } })
    .toArray();
  return docs as ChargingSession[];
}

export async function dbAppendSession(session: ChargingSession): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await col("sessions").insertOne(session as any);
  // Trim to 500
  const count = await col("sessions").countDocuments();
  if (count > 500) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldest = await col<any>("sessions")
      .find({}, { sort: { startTime: 1 }, limit: count - 500, projection: { _id: 1 } })
      .toArray();
    if (oldest.length) {
      await col("sessions").deleteMany({ _id: { $in: oldest.map((s: any) => s._id) } });
    }
  }
}

// ---- Settings (single document) ----

export async function dbLoadSettings(): Promise<GlobalSettings | null> {
  const doc = await col<any>("config").findOne({ _type: "settings" });
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, _type, ...settings } = doc;
  return settings as GlobalSettings;
}

export async function dbSaveSettings(s: GlobalSettings): Promise<void> {
  await col("config").updateOne(
    { _type: "settings" },
    { $set: { _type: "settings", ...s } },
    { upsert: true },
  );
}

// ---- Last commands (single document) ----

export async function dbLoadLastCommands(): Promise<Record<string, LastCommand> | null> {
  const doc = await col<any>("config").findOne({ _type: "last_commands" });
  if (!doc) return null;
  return doc.commands as Record<string, LastCommand>;
}

export async function dbSaveLastCommands(cmds: Record<string, LastCommand>): Promise<void> {
  await col("config").updateOne(
    { _type: "last_commands" },
    { $set: { _type: "last_commands", commands: cmds } },
    { upsert: true },
  );
}
