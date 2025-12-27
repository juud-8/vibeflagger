import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync("vibeflagger.db");
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  // Create profiles table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      relationship TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Create logs table (basic structure)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      person TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('GREEN', 'YELLOW', 'RED')),
      severity INTEGER NOT NULL CHECK(severity >= 1 AND severity <= 10),
      category TEXT NOT NULL,
      notes TEXT
    );
  `);

  // Add profile_id column if it doesn't exist (migration for existing databases)
  try {
    await database.execAsync(`ALTER TABLE logs ADD COLUMN profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL`);
  } catch (error: any) {
    // Column already exists, ignore error silently
  }

  // Migrate existing logs: link to profiles by name
  await migrateExistingData(database);
}

async function migrateExistingData(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check if migration is needed
  const existingLogs = await database.getAllAsync<{ person: string; profile_id: number | null }>(
    `SELECT DISTINCT person, profile_id FROM logs WHERE profile_id IS NULL LIMIT 1`
  );

  if (existingLogs.length === 0) return; // Already migrated or no data

  // Get all unique people from logs without profile_id
  const uniquePeople = await database.getAllAsync<{ person: string }>(
    `SELECT DISTINCT person FROM logs WHERE profile_id IS NULL`
  );

  // Create profiles for each unique person
  for (const { person } of uniquePeople) {
    // Check if profile already exists
    const existing = await database.getAllAsync<{ id: number }>(
      `SELECT id FROM profiles WHERE name = ?`,
      [person]
    );

    let profileId: number;
    if (existing.length > 0) {
      profileId = existing[0].id;
    } else {
      // Create new profile
      const result = await database.runAsync(
        `INSERT INTO profiles (name, relationship, created_at) VALUES (?, ?, ?)`,
        [person, "Unknown", new Date().toISOString()]
      );
      profileId = result.lastInsertRowId;
    }

    // Link existing logs to this profile
    await database.runAsync(
      `UPDATE logs SET profile_id = ? WHERE person = ? AND profile_id IS NULL`,
      [profileId, person]
    );
  }
}

export type LogType = "GREEN" | "YELLOW" | "RED";

export type LogCategory = "Communication" | "Money" | "Intimacy" | "Trust" | "Other";

export type RelationshipType = "Partner" | "Ex" | "Family" | "Friend" | "Boss" | "Coworker" | "Other";

export interface Profile {
  id: number;
  name: string;
  relationship: RelationshipType | string;
  created_at: string;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  person: string;
  profile_id: number | null;
  type: LogType;
  severity: number;
  category: LogCategory;
  notes: string | null;
}

export interface NewLogEntry {
  person: string;
  profile_id?: number;
  type: LogType;
  severity: number;
  category: LogCategory;
  notes?: string;
}

export interface NewProfile {
  name: string;
  relationship: RelationshipType | string;
}

// Profile operations
export async function createProfile(profile: NewProfile): Promise<number> {
  const database = await getDatabase();
  const timestamp = new Date().toISOString();

  const result = await database.runAsync(
    `INSERT INTO profiles (name, relationship, created_at) VALUES (?, ?, ?)`,
    [profile.name, profile.relationship, timestamp]
  );

  return result.lastInsertRowId;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const database = await getDatabase();
  const results = await database.getAllAsync<Profile>(
    `SELECT * FROM profiles ORDER BY name ASC`
  );

  return results;
}

export async function getProfileById(id: number): Promise<Profile | null> {
  const database = await getDatabase();
  const results = await database.getAllAsync<Profile>(
    `SELECT * FROM profiles WHERE id = ?`,
    [id]
  );
  return results.length > 0 ? results[0] : null;
}

export async function updateProfile(id: number, updates: Partial<NewProfile>): Promise<void> {
  const database = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.relationship !== undefined) {
    fields.push("relationship = ?");
    values.push(updates.relationship);
  }

  if (fields.length === 0) return;

  values.push(id);
  await database.runAsync(
    `UPDATE profiles SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
}

export async function deleteProfile(id: number): Promise<void> {
  const database = await getDatabase();
  // This will set profile_id to NULL in logs due to ON DELETE SET NULL
  await database.runAsync(`DELETE FROM profiles WHERE id = ?`, [id]);
}

// Log operations
export async function insertLog(entry: NewLogEntry): Promise<number> {
  const database = await getDatabase();
  const timestamp = new Date().toISOString();

  const result = await database.runAsync(
    `INSERT INTO logs (timestamp, person, profile_id, type, severity, category, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [timestamp, entry.person, entry.profile_id || null, entry.type, entry.severity, entry.category, entry.notes || null]
  );

  return result.lastInsertRowId;
}

export async function getAllLogs(): Promise<LogEntry[]> {
  const database = await getDatabase();
  const results = await database.getAllAsync<LogEntry>(
    `SELECT * FROM logs ORDER BY timestamp DESC`
  );
  return results;
}

export async function getRecentLogs(limit: number = 10): Promise<LogEntry[]> {
  const database = await getDatabase();
  const results = await database.getAllAsync<LogEntry>(
    `SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?`,
    [limit]
  );
  return results;
}

export async function getLogsByProfileId(profileId: number): Promise<LogEntry[]> {
  const database = await getDatabase();
  const results = await database.getAllAsync<LogEntry>(
    `SELECT * FROM logs WHERE profile_id = ? ORDER BY timestamp DESC`,
    [profileId]
  );
  return results;
}

export async function deleteLog(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM logs WHERE id = ?`, [id]);
}

export async function getUniquePeople(): Promise<string[]> {
  const database = await getDatabase();
  const results = await database.getAllAsync<{ person: string }>(
    `SELECT DISTINCT person FROM logs ORDER BY person ASC`
  );
  return results.map(r => r.person);
}

export function getScoreForType(type: LogType): number {
  switch (type) {
    case "GREEN":
      return 5;
    case "YELLOW":
      return 3;
    case "RED":
      return 1;
    default:
      return 3;
  }
}

export function calculateVibeScore(logs: LogEntry[]): number {
  if (logs.length === 0) return 0;

  let toxicitySum = 0;

  for (const log of logs) {
    switch (log.type) {
      case "RED":
        toxicitySum += log.severity;
        break;
      case "YELLOW":
        toxicitySum += log.severity / 2;
        break;
      case "GREEN":
        toxicitySum -= log.severity;
        break;
    }
  }

  const maxPossibleToxicity = logs.length * 10;
  const toxicityPercentage = (toxicitySum / maxPossibleToxicity) * 100;

  return Math.max(0, Math.min(100, Math.round(toxicityPercentage)));
}

export function getHealthStatus(score: number): string {
  if (score > 75) return "Critical";
  if (score >= 50) return "Toxic";
  if (score >= 25) return "Concerning";
  if (score > 0) return "Stable";
  return "Thriving";
}

export interface ProfileStats {
  profile: Profile;
  vibeScore: number;
  healthStatus: string;
  totalLogs: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  lastFlagDate: string | null;
}

export async function getProfileStats(profileId: number): Promise<ProfileStats | null> {
  const profile = await getProfileById(profileId);
  if (!profile) return null;

  const logs = await getLogsByProfileId(profileId);
  const vibeScore = calculateVibeScore(logs);
  const healthStatus = getHealthStatus(vibeScore);

  const redCount = logs.filter(l => l.type === "RED").length;
  const yellowCount = logs.filter(l => l.type === "YELLOW").length;
  const greenCount = logs.filter(l => l.type === "GREEN").length;

  const lastFlagDate = logs.length > 0 ? logs[0].timestamp : null;

  return {
    profile,
    vibeScore,
    healthStatus,
    totalLogs: logs.length,
    redCount,
    yellowCount,
    greenCount,
    lastFlagDate,
  };
}

export async function getAllProfilesWithStats(): Promise<ProfileStats[]> {
  const profiles = await getAllProfiles();
  const stats: ProfileStats[] = [];

  for (const profile of profiles) {
    const profileStats = await getProfileStats(profile.id);
    if (profileStats) {
      stats.push(profileStats);
    }
  }

  return stats;
}

export interface TopProfile {
  id: number;
  name: string;
  flagCount: number;
}

export async function getTopProfilesByLogCount(limit: number = 3): Promise<TopProfile[]> {
  const database = await getDatabase();

  // Query top profiles by log count, trying profile_id first
  let results: TopProfile[] = [];

  try {
    // Try with profile_id join first
    results = await database.getAllAsync<TopProfile>(`
      SELECT p.id, p.name, COUNT(l.id) as flagCount
      FROM profiles p
      LEFT JOIN logs l ON p.id = l.profile_id
      GROUP BY p.id
      HAVING flagCount > 0
      ORDER BY flagCount DESC
      LIMIT ?
    `, [limit]);
  } catch (e) {
    // Fallback to person name join if profile_id fails
  }

  // If no results, try joining by person name
  if (results.length === 0) {
    results = await database.getAllAsync<TopProfile>(`
      SELECT p.id, p.name, COUNT(l.id) as flagCount
      FROM profiles p
      LEFT JOIN logs l ON p.name = l.person
      GROUP BY p.id
      HAVING flagCount > 0
      ORDER BY flagCount DESC
      LIMIT ?
    `, [limit]);
  }

  return results;
}
