import { GuildMember } from 'discord.js';

/**
 * 新メンバー参加時に「未認証」ロールを自動付与する。
 */
export default async function guildMemberAddHandler(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const unverifiedRole = member.guild.roles.cache.find((role) => role.name === '未認証');
  if (!unverifiedRole) {
    console.error(`[guildMemberAdd] 未認証ロールが見つかりません (guild: ${member.guild.id})`);
    return;
  }

  try {
    await member.roles.add(unverifiedRole);
  } catch (error) {
    console.error(`[guildMemberAdd] ロール付与に失敗しました (user: ${member.id}):`, error);
  }
}
