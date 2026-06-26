import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { buildUserProfile } from '../utils/profile.js';
import { formatDateJST } from '../utils/format-date.js';

/**
 * /profile コマンドの実行ハンドラ。
 */
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand(false);

  if (subcommand === 'activity') {
    await interaction.reply({ content: '大会参加履歴はまだありません。', ephemeral: true });
    return;
  }

  let targetMember: GuildMember | null;

  if (subcommand === 'user') {
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

    targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: '指定されたユーザーが見つかりません。', ephemeral: true });
      return;
    }
  } else {
    targetMember = interaction.member as GuildMember;
  }

  const profile = await buildUserProfile(targetMember);

  if (!profile) {
    if (subcommand === 'user') {
      await interaction.reply({ content: 'このユーザーはまだ認証されていません。', ephemeral: true });
    } else {
      await interaction.reply({ content: '認証されていません。/verify を実行してください。', ephemeral: true });
    }
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('プロフィール')
    .setColor(0x3498db)
    .addFields(
      { name: 'ユーザー', value: `<@${profile.userId}> (${targetMember.displayName})`, inline: false },
      { name: 'ユーザーID', value: profile.userId, inline: false },
      { name: '学籍番号', value: profile.studentNumber, inline: false },
      { name: '入学年度', value: profile.enrollmentYear, inline: false },
      { name: '認証日時', value: formatDateJST(new Date(profile.verifiedAt)), inline: false },
      { name: 'アカウント作成日', value: formatDateJST(new Date(profile.accountCreatedAt)), inline: false },
      { name: 'ゲームロール', value: profile.gameRoles.length > 0 ? profile.gameRoles.join(', ') : 'なし', inline: false },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('プロフィールを表示します')
  .addSubcommand((sub) =>
    sub.setName('activity').setDescription('大会参加履歴を表示します'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('user')
      .setDescription('指定ユーザーのプロフィールを照会します（管理者専用）')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('照会するユーザー').setRequired(true),
      ),
  );
