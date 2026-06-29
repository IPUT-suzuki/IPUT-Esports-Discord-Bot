import { GuildMember } from 'discord.js';
import { VerifiedUser } from '../types/VerifiedUser.js';
import { UserProfile } from '../types/UserProfile.js';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_PATH = resolve(process.cwd(), 'src/data/verified.json');

/**
 * verified.json から全認証ユーザーを読み込む。
 */
export async function loadVerifiedUsers(): Promise<Record<string, VerifiedUser>> {
  if (!existsSync(DATA_PATH)) {
    return {};
  }
  try {
    const content = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(content) as Record<string, VerifiedUser>;
  } catch {
    return {};
  }
}

/**
 * verified.json に認証ユーザーを保存する。
 */
export async function saveVerifiedUser(userId: string, data: VerifiedUser): Promise<void> {
  const users = await loadVerifiedUsers();
  users[userId] = data;
  await writeFile(DATA_PATH, JSON.stringify(users, null, 2) + '\n', 'utf-8');
}

/**
 * 指定ユーザーの認証情報を取得する。
 */
export async function getVerifiedUser(userId: string): Promise<VerifiedUser | undefined> {
  const users = await loadVerifiedUsers();
  return users[userId];
}

/**
 * verified.json から指定ユーザーの認証情報を削除する。
 */
export async function removeVerifiedUser(userId: string): Promise<void> {
  const users = await loadVerifiedUsers();
  delete users[userId];
  await writeFile(DATA_PATH, JSON.stringify(users, null, 2) + '\n', 'utf-8');
}

/**
 * 指定ユーザーのプロフィール情報を組み立てる。
 */
export async function buildUserProfile(member: GuildMember): Promise<UserProfile | undefined> {
  const verified = await getVerifiedUser(member.id);
  if (!verified) {
    return undefined;
  }

  const gameRoles = member.roles.cache
    .filter((role) => role.name.startsWith('Game:'))
    .map((role) => role.name.slice(5));

  return {
    ...verified,
    accountCreatedAt: member.user.createdAt.toISOString(),
    joinedAt: member.joinedAt?.toISOString() ?? new Date().toISOString(),
    gameRoles: gameRoles.length > 0 ? gameRoles : [],
  };
}
