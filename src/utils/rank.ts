import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GameDefinition, UserRanks } from '../types/GameRank.js';

const GAMES_PATH = resolve(process.cwd(), 'src/data/games.json');
const RANKS_PATH = resolve(process.cwd(), 'src/data/ranks.json');

let cachedGames: GameDefinition[] | null = null;

/**
 * games.json から対応ゲーム一覧を読み込む。
 * 初回以降はキャッシュを返す。
 */
export function loadGames(): GameDefinition[] {
  if (cachedGames) {
    return cachedGames;
  }

  try {
    const content = readFileSync(GAMES_PATH, 'utf-8');
    cachedGames = JSON.parse(content) as GameDefinition[];
    return cachedGames;
  } catch {
    return [];
  }
}

/**
 * 指定されたゲームIDが存在するか確認する。
 */
export function getGameById(gameId: string): GameDefinition | undefined {
  const games = loadGames();
  return games.find((g) => g.id.toLowerCase() === gameId.toLowerCase());
}

/**
 * 指定されたランクがゲームの定義に存在するか確認する。
 */
export function isValidRank(game: GameDefinition, rank: string): boolean {
  return game.ranks.some((r) => r.toLowerCase() === rank.toLowerCase());
}

/**
 * ranks.json から全ユーザーのランク情報を読み込む。
 */
export async function loadAllRanks(): Promise<Record<string, UserRanks>> {
  if (!existsSync(RANKS_PATH)) {
    return {};
  }
  try {
    const content = await readFile(RANKS_PATH, 'utf-8');
    return JSON.parse(content) as Record<string, UserRanks>;
  } catch {
    return {};
  }
}

/**
 * ranks.json から特定ユーザーのランク情報を読み込む。
 */
export async function loadUserRanks(userId: string): Promise<UserRanks> {
  const allRanks = await loadAllRanks();
  return allRanks[userId] ?? {};
}

/**
 * ranks.json にユーザーのランクを保存する。
 */
export async function saveUserRank(userId: string, gameId: string, rank: string): Promise<void> {
  const allRanks = await loadAllRanks();
  if (!allRanks[userId]) {
    allRanks[userId] = {};
  }
  allRanks[userId][gameId] = rank;
  await writeFile(RANKS_PATH, JSON.stringify(allRanks, null, 2) + '\n', 'utf-8');
}

/**
 * 指定ゲームのランクを削除する。
 */
export async function removeUserRank(userId: string, gameId: string): Promise<void> {
  const allRanks = await loadAllRanks();
  if (allRanks[userId]) {
    delete allRanks[userId][gameId];
    if (Object.keys(allRanks[userId]).length === 0) {
      delete allRanks[userId];
    }
    await writeFile(RANKS_PATH, JSON.stringify(allRanks, null, 2) + '\n', 'utf-8');
  }
}

// キャッシュ用のヘルパー（Node.js の fs/promises には readFileSync がないため node:fs を直接使用）
import { readFileSync } from 'node:fs';
