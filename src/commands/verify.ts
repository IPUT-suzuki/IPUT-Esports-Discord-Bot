import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { saveVerifiedUser } from '../utils/profile.js';
import { notifyVerification } from '../utils/notification.js';
import { sendVerificationCodeEmail } from '../utils/email.js';
import { VerifiedUser } from '../types/VerifiedUser.js';
import process from 'node:process';

interface VerificationSession {
  studentNumber: string;
  enrollmentYear: string;
  code: string;
  expiresAt: number;
}

const sessions = new Map<string, VerificationSession>();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getStudentEmail(studentNumber: string): string {
  return `tk${studentNumber}@tks.iput.ac.jp`;
}

/**
 * /verify コマンドの実行ハンドラ。
 */
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('verify-modal')
    .setTitle('学籍番号認証')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('student-number')
          .setLabel('学籍番号（6桁の数字）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('240001')
          .setMaxLength(6)
          .setMinLength(6)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

/**
 * 学籍番号入力Modalの送信ハンドラ。
 */
export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId === 'verify-modal') {
    const input = interaction.fields.getTextInputValue('student-number');

    if (!/^\d{6}$/.test(input)) {
      await interaction.reply({
        content: '学籍番号の形式が正しくありません。6桁の数字で入力してください。',
        ephemeral: true,
      });
      return;
    }

    const studentNumber = `TK${input}`;
    const enrollmentYear = input.slice(0, 2);
    const code = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分

    sessions.set(interaction.user.id, { studentNumber, enrollmentYear, code, expiresAt });

    try {
      await sendVerificationCodeEmail(getStudentEmail(input), code);
    } catch (error) {
      sessions.delete(interaction.user.id);
      console.error('[Verify] Failed to send verification email:', error);
      const reply = interaction.replied || interaction.deferred
        ? interaction.editReply.bind(interaction)
        : interaction.reply.bind(interaction);
      await reply({
        content: 'メールの送信に失敗しました。しばらく経ってから再度お試しください。',
        ephemeral: true,
      });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`verify-code-button:${interaction.user.id}`)
        .setLabel('認証コードを入力')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({
      content: 'メールを送信しました。受信した認証コードを入力してください。（有効期限: 5分）',
      components: [row],
      ephemeral: true,
    });

    // 5分後にセッションを自動削除
    setTimeout(() => {
      sessions.delete(interaction.user.id);
    }, 5 * 60 * 1000);
    return;
  }

  if (interaction.customId.startsWith('verify-code-modal:')) {
    const userId = interaction.customId.split(':')[1];
    if (interaction.user.id !== userId) {
      await interaction.reply({ content: 'この操作は他のユーザーが実行できません。', ephemeral: true });
      return;
    }

    const session = sessions.get(userId);
    if (!session) {
      await interaction.reply({
        content: '認証時間が切れました。/verify からやり直してください。',
        ephemeral: true,
      });
      return;
    }

    if (Date.now() > session.expiresAt) {
      sessions.delete(userId);
      await interaction.reply({
        content: '認証時間が切れました。/verify からやり直してください。',
        ephemeral: true,
      });
      return;
    }

    const inputCode = interaction.fields.getTextInputValue('verification-code');
    if (inputCode !== session.code) {
      await interaction.reply({ content: '認証コードが正しくありません。', ephemeral: true });
      return;
    }

    // 認証成功
    const member = interaction.guild?.members.cache.get(userId) ?? await interaction.guild?.members.fetch(userId).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'エラーが発生しました。管理者に連絡してください。', ephemeral: true });
      return;
    }

    const unverifiedRole = member.guild.roles.cache.find((r) => r.name === '未認証');
    const verifiedRole = member.guild.roles.cache.find((r) => r.name === '認証済み');

    try {
      if (unverifiedRole) {
        await member.roles.remove(unverifiedRole);
      }
      if (verifiedRole) {
        await member.roles.add(verifiedRole);
      }
    } catch {
      await interaction.reply({ content: 'Bot の権限が不足しています。管理者に連絡してください。', ephemeral: true });
      return;
    }

    if (!unverifiedRole || !verifiedRole) {
      await interaction.reply({ content: 'サーバー設定に問題があります。管理者に連絡してください。', ephemeral: true });
      return;
    }

    const verifiedData: VerifiedUser = {
      userId,
      studentNumber: session.studentNumber,
      enrollmentYear: session.enrollmentYear,
      verifiedAt: new Date().toISOString(),
    };

    await saveVerifiedUser(userId, verifiedData);
    sessions.delete(userId);

    await interaction.reply({ content: '認証が完了しました。', ephemeral: true });

    // 運営通知（ベストエフォート）
    await notifyVerification(member.guild, interaction.user, verifiedData);
  }
}

/**
 * 認証コード入力ボタンのハンドラ。
 */
export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('verify-code-button:')) return;

  const userId = interaction.customId.split(':')[1];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: 'このボタンは他のユーザーが使用できません。', ephemeral: true });
    return;
  }

  const session = sessions.get(userId);
  if (!session || Date.now() > session.expiresAt) {
    sessions.delete(userId);
    await interaction.reply({
      content: '認証時間が切れました。/verify からやり直してください。',
      ephemeral: true,
    });
    return;
  }

  const remainingSeconds = Math.ceil((session.expiresAt - Date.now()) / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const modal = new ModalBuilder()
    .setCustomId(`verify-code-modal:${userId}`)
    .setTitle('認証コード入力')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('verification-code')
          .setLabel(`認証コード（残り ${minutes}分${seconds}秒）`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('6桁のコード')
          .setMaxLength(6)
          .setMinLength(6)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('学籍番号で認証します');
