import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import {
  loadGames,
  getGameById,
  isValidRank,
  loadUserRanks,
  saveUserRank,
  removeUserRank,
} from '../utils/rank.js';

/**
 * /rank コマンドの実行ハンドラ。
 */
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand(false);

  if (subcommand === 'games') {
    await handleGames(interaction);
    return;
  }

  if (subcommand === 'set') {
    await handleSet(interaction);
    return;
  }

  if (subcommand === 'remove') {
    await handleRemove(interaction);
    return;
  }

  if (subcommand === 'user') {
    await handleUser(interaction);
    return;
  }

  // 引数なし: 自分のランク一覧
  await handleList(interaction, interaction.user.id, interaction.member as GuildMember);
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  userId: string,
  member: GuildMember,
): Promise<void> {
  const ranks = await loadUserRanks(userId);
  const games = loadGames();

  if (Object.keys(ranks).length === 0) {
    await interaction.reply({
      content: 'まだランクが登録されていません。`/rank set` で登録してください。',
      ephemeral: true,
    });
    return;
  }

  const registeredFields: string[] = [];
  const unregisteredGames: string[] = [];

  for (const game of games) {
    if (ranks[game.id]) {
      registeredFields.push(`${game.name}: ${ranks[game.id]}`);
    } else {
      unregisteredGames.push(game.name);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('登録済みランク')
    .setColor(0x3498db)
    .setDescription(registeredFields.join('\n'));

  if (unregisteredGames.length > 0) {
    embed.addFields({
      name: '未登録のゲーム',
      value: unregisteredGames.join(', '),
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSet(interaction: ChatInputCommandInteraction): Promise<void> {
  const gameId = interaction.options.getString('game', true);
  const rank = interaction.options.getString('rank', true);

  const game = getGameById(gameId);
  if (!game) {
    await interaction.reply({
      content: '指定されたゲームは登録されていません。`/rank games` で確認してください。',
      ephemeral: true,
    });
    return;
  }

  if (!isValidRank(game, rank)) {
    await interaction.reply({
      content: '指定されたランクは存在しません。`/rank games` で確認してください。',
      ephemeral: true,
    });
    return;
  }

  // 正規化: 定義に一致する大文字小文字に変換
  const normalizedRank = game.ranks.find((r) => r.toLowerCase() === rank.toLowerCase())!;
  await saveUserRank(interaction.user.id, game.id, normalizedRank);

  await interaction.reply({
    content: `${game.name} のランクを「${normalizedRank}」に設定しました。`,
    ephemeral: true,
  });
}

async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const gameId = interaction.options.getString('game', true);

  const game = getGameById(gameId);
  if (!game) {
    await interaction.reply({
      content: '指定されたゲームは登録されていません。`/rank games` で確認してください。',
      ephemeral: true,
    });
    return;
  }

  const ranks = await loadUserRanks(interaction.user.id);
  if (!ranks[game.id]) {
    await interaction.reply({
      content: 'このゲームのランクは登録されていません。',
      ephemeral: true,
    });
    return;
  }

  await removeUserRank(interaction.user.id, game.id);
  await interaction.reply({
    content: `${game.name} のランクを削除しました。`,
    ephemeral: true,
  });
}

async function handleUser(interaction: ChatInputCommandInteraction): Promise<void> {
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

  const targetMember = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    await interaction.reply({ content: '指定されたユーザーが見つかりません。', ephemeral: true });
    return;
  }

  await handleList(interaction, targetUser.id, targetMember);
}

async function handleGames(interaction: ChatInputCommandInteraction): Promise<void> {
  const games = loadGames();

  if (games.length === 0) {
    await interaction.reply({ content: '登録されているゲームがありません。', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('対応ゲーム一覧')
    .setColor(0x3498db);

  for (const game of games) {
    embed.addFields({
      name: game.name,
      value: game.ranks.join(' → '),
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('ゲームのランクを管理します')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('ランクを登録または更新します')
      .addStringOption((opt) =>
        opt.setName('game').setDescription('ゲーム名（ID）').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('rank').setDescription('ランク').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('ランクを削除します')
      .addStringOption((opt) =>
        opt.setName('game').setDescription('ゲーム名（ID）').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('user')
      .setDescription('指定ユーザーのランクを確認します（管理者専用）')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('確認するユーザー').setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName('games').setDescription('登録可能なゲーム一覧を表示します'));
