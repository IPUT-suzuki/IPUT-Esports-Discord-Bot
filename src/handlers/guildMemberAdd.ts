import { GuildMember } from 'discord.js';

export default async function guildMemberAddHandler(member: GuildMember): Promise<void> {
  if (member.user.bot) {
    return;
  }

  try {
    const role = member.guild.roles.cache.find(
      (r) => r.name === '未認証',
    );

    if (!role) {
      console.error(
        `[guildMemberAdd] Role "未認証" not found in guild: ${member.guild.name} (${member.guild.id})`,
      );
      return;
    }

    await member.roles.add(role);
    console.log(
      `[guildMemberAdd] Assigned "未認証" role to ${member.user.tag} (${member.id})`,
    );
  } catch (error) {
    console.error(
      `[guildMemberAdd] Failed to assign "未認証" role to ${member.user.tag} (${member.id}):`,
      error,
    );
  }
}
