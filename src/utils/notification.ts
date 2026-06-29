import { Guild, User, EmbedBuilder, TextChannel } from 'discord.js';
import { VerifiedUser } from '../types/VerifiedUser.js';
import { formatDateJST } from './format-date.js';
import process from 'node:process';

/**
 * 認証完了を運営チャンネルに通知する。
 * エラーが発生しても呼び出し元には影響を与えない（ベストエフォート）。
 */
export async function notifyVerification(
  guild: Guild,
  user: User,
  verifiedUser: VerifiedUser,
): Promise<void> {
  try {
    const channelId = process.env.NOTIFICATION_CHANNEL_ID;
    if (!channelId) {
      console.error('[Notification] NOTIFICATION_CHANNEL_ID is not set');
      return;
    }

    const channel = await guild.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`[Notification] Channel ${channelId} not found or not text-based`);
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    const displayName = member?.displayName ?? user.displayName;

    const embed = new EmbedBuilder()
      .setTitle('✅ 認証完了')
      .setColor(0x00FF7F)
      .addFields(
        { name: 'ユーザー', value: `<@${user.id}> (${displayName})`, inline: false },
        { name: 'ユーザーID', value: user.id, inline: false },
        { name: '学籍番号', value: verifiedUser.studentNumber, inline: false },
        { name: '入学年度', value: verifiedUser.enrollmentYear, inline: false },
        { name: '認証日時', value: formatDateJST(new Date(verifiedUser.verifiedAt)), inline: false },
        { name: 'アカウント作成日', value: formatDateJST(user.createdAt), inline: false },
        { name: 'サーバー参加日', value: member?.joinedAt ? formatDateJST(member.joinedAt) : '不明', inline: false },
      )
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    console.error('[Notification] Failed to send verification notification:', error);
  }
}

/**
 * 認証解除を運営チャンネルに通知する。
 * エラーが発生しても呼び出し元には影響を与えない（ベストエフォート）。
 */
export async function notifyUnverification(
  guild: Guild,
  user: User,
  executor: User,
  studentNumber: string,
): Promise<void> {
  try {
    const channelId = process.env.NOTIFICATION_CHANNEL_ID;
    if (!channelId) {
      console.error('[Notification] NOTIFICATION_CHANNEL_ID is not set');
      return;
    }

    const channel = await guild.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`[Notification] Channel ${channelId} not found or not text-based`);
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    const displayName = member?.displayName ?? user.displayName;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ 認証解除')
      .setColor(0xFF6347)
      .addFields(
        { name: 'ユーザー', value: `<@${user.id}> (${displayName})`, inline: false },
        { name: 'ユーザーID', value: user.id, inline: false },
        { name: '学籍番号', value: studentNumber, inline: false },
        { name: '解除者', value: `<@${executor.id}>`, inline: false },
        { name: '解除日時', value: formatDateJST(new Date()), inline: false },
      )
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    console.error('[Notification] Failed to send unverification notification:', error);
  }
}
