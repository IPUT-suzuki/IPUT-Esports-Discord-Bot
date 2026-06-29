import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_PATH = resolve(process.cwd(), 'src/data/activity.json');

interface DailyActivity {
  messages: Record<string, number>;
  voiceMinutes: Record<string, number>;
}

let buffer: Record<string, DailyActivity> = {};
let flushInterval: ReturnType<typeof setInterval> | null = null;
let isDirty = false;

function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * activity.json から全データを読み込む。
 */
export async function loadActivityData(): Promise<Record<string, DailyActivity>> {
  if (!existsSync(DATA_PATH)) {
    return {};
  }
  try {
    const content = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(content) as Record<string, DailyActivity>;
  } catch {
    return {};
  }
}

/**
 * バッファを activity.json に書き込む。
 */
export async function flushActivityData(): Promise<void> {
  if (!isDirty) return;
  await writeFile(DATA_PATH, JSON.stringify(buffer, null, 2) + '\n', 'utf-8');
  isDirty = false;
}

/**
 * 定期自動フラッシュを開始する。
 */
export function startAutoFlush(intervalMs = 10000): void {
  if (flushInterval) return;
  flushInterval = setInterval(() => {
    flushActivityData().catch((err) => {
      console.error('[Activity] Failed to flush activity data:', err);
    });
  }, intervalMs);
}

/**
 * 定期自動フラッシュを停止する。
 */
export function stopAutoFlush(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

/**
 * データを初期化する（起動時に呼び出し）。
 */
export async function initActivityBuffer(): Promise<void> {
  buffer = await loadActivityData();
}

/**
 * メッセージ送信をカウントする。
 */
export function trackMessage(userId: string): void {
  const today = getToday();
  if (!buffer[today]) {
    buffer[today] = { messages: {}, voiceMinutes: {} };
  }
  buffer[today].messages[userId] = (buffer[today].messages[userId] ?? 0) + 1;
  isDirty = true;
}

/**
 * VC滞在時間を加算する（分単位）。
 */
export function trackVoiceTime(userId: string, minutes: number): void {
  const today = getToday();
  if (!buffer[today]) {
    buffer[today] = { messages: {}, voiceMinutes: {} };
  }
  buffer[today].voiceMinutes[userId] = (buffer[today].voiceMinutes[userId] ?? 0) + minutes;
  isDirty = true;
}

function getTargetDates(period: 'monthly' | 'yearly'): string[] {
  const dates: string[] = [];
  const now = new Date();

  if (period === 'monthly') {
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
  } else {
    // yearly = academic year (April - March)
    const currentMonth = now.getMonth() + 1;
    const yearStart = currentMonth >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    const startDate = new Date(yearStart, 3, 1); // April 1
    const endDate = new Date(yearStart + 1, 2, 31); // March 31

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

interface LeaderboardEntry {
  userId: string;
  count: number;
}

/**
 * ランキングデータを取得する。
 */
export async function getLeaderboard(
  period: 'monthly' | 'yearly',
  type: 'messages' | 'voice',
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const targetDates = getTargetDates(period);
  const aggregated: Record<string, number> = {};

  for (const date of targetDates) {
    const dayData = buffer[date];
    if (!dayData) continue;

    const source = type === 'messages' ? dayData.messages : dayData.voiceMinutes;
    for (const [userId, count] of Object.entries(source)) {
      aggregated[userId] = (aggregated[userId] ?? 0) + count;
    }
  }

  const entries: LeaderboardEntry[] = Object.entries(aggregated)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return entries;
}
