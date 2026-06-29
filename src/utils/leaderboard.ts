import { Client, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, TextChannel, ButtonInteraction } from 'discord.js';
import { getLeaderboard } from './activity.js';
import process from 'node:process';

interface ChannelConfig {
  envKey: string;
  period: 'monthly' | 'yearly';
  label: string;
}

const channels: ChannelConfig[] = [
  { envKey: 'LEADERBOARD_MONTHLY_CHANNEL_ID', period: 'monthly', label: '月間' },
  { envKey: 'LEADERBOARD_YEARLY_CHANNEL_ID', period: 'yearly', label: '年度間' },
];

const messageIds: Record<string, string> = {};
const lastPostDates: Record<string, string> = {};
const currentTypes: Record<string, 'messages' | 'voice'> = {
  LEADERBOARD_MONTHLY_CHANNEL_ID: 'messages',
  LEADERBOARD_YEARLY_CHANNEL_ID: 'messages',
};

function shouldReset(period: 'monthly' | 'yearly', lastDate: string | undefined): boolean {
  if (!lastDate) return true;
  const now = new Date();
  const last = new Date(lastDate);

  if (period === 'monthly') {
    return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
  }

  const nowYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const lastYearStart = last.getMonth() >= 3 ? last.getFullYear() : last.getFullYear() - 1;
  return nowYearStart !== lastYearStart;
}

function buildEmbed(
  period: 'monthly' | 'yearly',
  type: 'messages' | 'voice',
): EmbedBuilder {
  const periodLabel = period === 'monthly' ? '月間' : '年度間';
  const typeLabel = type === 'messages' ? 'メッセージ数' : 'VC時間';
  const color = type === 'messages' ? 0x3498db : 0x2ecc71;

  return new EmbedBuilder()
    .setTitle(`📊 ${periodLabel}アクティビティランキング（${typeLabel}）`)
    .setColor(color)
    .setTimestamp();
}

async function updateChannel(
  client: Client,
  config: ChannelConfig,
  type: 'messages' | 'voice',
): Promise<void> {
  const channelId = process.env[config.envKey];
  if (!channelId) {
    console.error(`[Leaderboard] ${config.envKey} is not set`);
    return;
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    console.error(`[Leaderboard] Channel ${channelId} not found or not text-based`);
    return;
  }

  const entries = await getLeaderboard(config.period, type, 10);
  const embed = buildEmbed(config.period, type);

  if (entries.length === 0) {
    embed.setDescription('まだデータがありません。');
  } else {
    const unit = type === 'messages' ? 'メッセージ' : '分';
    const lines = entries.map((e, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      return `${medal} <@${e.userId}> — ${e.count.toLocaleString()} ${unit}`;
    });
    embed.setDescription(lines.join('\n'));
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard:${config.period}:messages`)
      .setLabel('📝 メッセージ数')
      .setStyle(type === 'messages' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`leaderboard:${config.period}:voice`)
      .setLabel('🎤 VC時間')
      .setStyle(type === 'voice' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const key = config.envKey;
  const now = new Date().toISOString();

  if (shouldReset(config.period, lastPostDates[key])) {
    // リセット時は新規メッセージを投稿
    const message = await (channel as TextChannel).send({
      embeds: [embed],
      components: [row],
    });
    messageIds[key] = message.id;
    lastPostDates[key] = now;
  } else {
    const messageId = messageIds[key];
    if (messageId) {
      try {
        const message = await (channel as TextChannel).messages.fetch(messageId);
        await message.edit({ embeds: [embed], components: [row] });
      } catch {
        // メッセージが削除されていた場合は新規投稿
        const message = await (channel as TextChannel).send({
          embeds: [embed],
          components: [row],
        });
        messageIds[key] = message.id;
      }
    } else {
      const message = await (channel as TextChannel).send({
        embeds: [embed],
        components: [row],
      });
      messageIds[key] = message.id;
    }
    lastPostDates[key] = now;
  }
}

/**
 * リーダーボードチャンネルを更新する。
 */
async function updateLeaderboardChannels(client: Client): Promise<void> {
  for (const config of channels) {
    try {
      const type = currentTypes[config.envKey] ?? 'messages';
      await updateChannel(client, config, type);
    } catch (error) {
      console.error(`[Leaderboard] Failed to update ${config.label}:`, error);
    }
  }
}

/**
 * リーダーボードのボタンインタラクションを処理する。
 */
export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('leaderboard:')) return;

  const parts = interaction.customId.split(':');
  if (parts.length !== 3) return;

  const period = parts[1] as 'monthly' | 'yearly';
  const type = parts[2] as 'messages' | 'voice';

  try {
    const entries = await getLeaderboard(period, type, 10);
    const embed = buildEmbed(period, type);

    if (entries.length === 0) {
      embed.setDescription('まだデータがありません。');
    } else {
      const unit = type === 'messages' ? 'メッセージ' : '分';
      const lines = entries.map((e, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        return `${medal} <@${e.userId}> — ${e.count.toLocaleString()} ${unit}`;
      });
      embed.setDescription(lines.join('\n'));
    }

    const config = channels.find((c) => c.period === period);
    if (!config) return;

    currentTypes[config.envKey] = type;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`leaderboard:${period}:messages`)
        .setLabel('📝 メッセージ数')
        .setStyle(type === 'messages' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`leaderboard:${period}:voice`)
        .setLabel('🎤 VC時間')
        .setStyle(type === 'voice' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );

    await interaction.message.edit({ embeds: [embed], components: [row] });
    await interaction.deferUpdate();
  } catch (error) {
    console.error('[Leaderboard] Button handler error:', error);
    await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true }).catch(() => {});
  }
}

/**
 * リーダーボードの定期更新を開始する。
 */
export function startLeaderboardUpdater(client: Client): void {
  // 初回即時実行
  updateLeaderboardChannels(client).catch((err) => {
    console.error('[Leaderboard] Initial update failed:', err);
  });

  // 10分ごとに更新
  setInterval(() => {
    updateLeaderboardChannels(client).catch((err) => {
      console.error('[Leaderboard] Periodic update failed:', err);
    });
  }, 600000);
}
