import { Events, Message } from 'discord.js';
import { trackMessage } from '../utils/activity.js';

/**
 * messageCreate イベントハンドラ。
 * メッセージ送信回数をカウントする。
 */
export default async function messageCreateHandler(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  try {
    trackMessage(message.author.id);
  } catch (error) {
    console.error('[messageCreate] Failed to track message:', error);
  }
}
