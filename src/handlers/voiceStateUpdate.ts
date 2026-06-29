import { Events, VoiceState } from 'discord.js';
import { trackVoiceTime } from '../utils/activity.js';

const voiceSessions = new Map<string, { joinedAt: number }>();

/**
 * voiceStateUpdate イベントハンドラ。
 * VCの入退室を検出し滞在時間を計測する。
 */
export default async function voiceStateUpdateHandler(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const userId = member.id;

  try {
    // 入室
    if (!oldState.channelId && newState.channelId) {
      voiceSessions.set(userId, { joinedAt: Date.now() });
      return;
    }

    // 退出
    if (oldState.channelId && !newState.channelId) {
      const session = voiceSessions.get(userId);
      if (session) {
        const elapsedMs = Date.now() - session.joinedAt;
        const minutes = Math.max(1, Math.ceil(elapsedMs / 60000));
        trackVoiceTime(userId, minutes);
        voiceSessions.delete(userId);
      }
      return;
    }

    // チャンネル移動
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const session = voiceSessions.get(userId);
      if (session) {
        const elapsedMs = Date.now() - session.joinedAt;
        const minutes = Math.max(1, Math.ceil(elapsedMs / 60000));
        trackVoiceTime(userId, minutes);
      }
      voiceSessions.set(userId, { joinedAt: Date.now() });
      return;
    }
  } catch (error) {
    console.error('[voiceStateUpdate] Failed to track voice time:', error);
  }
}
