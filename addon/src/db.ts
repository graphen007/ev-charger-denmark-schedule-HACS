import { MongoClient, type Collection, type Db } from "mongodb";
import type { ChargingSession } from "./settings.js";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const DB_NAME     = "ev_charging";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<void> {
  if (client) return;
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(DB_NAME);
  // Ensure index on carId + startTime for fast history queries
  await db.collection("sessions").createIndex({ carId: 1, startTime: -1 });
  console.log(`[DB] Connected to MongoDB at ${MONGODB_URI}`);
}

function sessions(): Collection<ChargingSession> {
  if (!db) throw new Error("MongoDB not connected — call connectDb() first");
  return db.collection<ChargingSession>("sessions");
}

export async function dbLoadSessions(): Promise<ChargingSession[]> {
  return sessions().find({}, { sort: { startTime: 1 }, limit: 500 }).toArray() as Promise<ChargingSession[]>;
}

export async function dbAppendSession(session: ChargingSession): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sessions().insertOne(session as any);
  // Keep last 500 sessions
  const count = await sessions().countDocuments();
  if (count > 500) {
    const oldest = await sessions()
      .find({}, { sort: { startTime: 1 }, limit: count - 500 })
      .toArray();
    if (oldest.length) {
      await sessions().deleteMany({ _id: { $in: oldest.map(s => (s as any)._id) } });
    }
  }
}

/** Returns true if MongoDB is available and connected. */
export function isDbConnected(): boolean {
  return db !== null;
}
