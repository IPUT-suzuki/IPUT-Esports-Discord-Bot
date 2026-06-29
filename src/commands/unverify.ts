import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { removeVerifiedUser, getVerifiedUser } from '../utils/profile.js';
import { notifyUnverification } from '../utils/notification.js';

/**
 * /unverify コマンドの実行ハンドラ。
 */
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  if (!targetUser) {
    await interaction.reply({ content: '指定されたユーザーが見つかりません。', ephemeral: true });
    return;
  }

  const executor = interaction.member;
  const isAdmin =
    (executor instanceof GuildMember && executor.permissions.has(PermissionFlagsBits.Administrator)) ||
    (executor instanceof GuildMember && executor.roles.cache.some((r) => r.name === '運営'));

  if (!isAdmin) {
    await interaction.reply({ content: 'このコマンドは管理者のみ使用できます。', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: '指定されたユーザーが見つかりません。', ephemeral: true });
    return;
  }

  const verifiedData = await getVerifiedUser(member.id);
  if (!verifiedData) {
    await interaction.reply({ content: 'このユーザーはまだ認証されていません。', ephemeral: true });
    return;
  }

  const verifiedRole = member.guild.roles.cache.find((r) => r.name === '認証済み');
  const unverifiedRole = member.guild.roles.cache.find((r) => r.name === '未認証');

  try {
    if (verifiedRole) {
      await member.roles.remove(verifiedRole);
    }
    if (unverifiedRole) {
      await member.roles.add(unverifiedRole);
    }
  } catch {
    await interaction.reply({ content: 'Bot の権限が不足しています。管理者に連絡してください。', ephemeral: true });
    return;
  }

  await removeVerifiedUser(member.id);

  await interaction.reply({
    content: `<@${member.id}> の認証を解除しました。`,
    ephemeral: true,
  });

  await notifyUnverification(
    interaction.guild,
    targetUser,
    interaction.user,
    verifiedData.studentNumber,
  );
}

export const data = new SlashCommandBuilder()
  .setName('unverify')
  .setDescription('指定ユーザーの認証を解除します（管理者専用）')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('認証を解除するユーザー').setRequired(true),
  );
