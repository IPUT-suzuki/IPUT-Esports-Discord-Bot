import {
  Events,
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import * as verifyCommand from '../commands/verify.js';
import * as profileCommand from '../commands/profile.js';

/**
 * インタラクションイベントのハンドラ。
 */
export default async function interactionCreateHandler(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
    return;
  }

  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
    return;
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;

  try {
    if (commandName === 'verify') {
      await verifyCommand.execute(interaction);
    } else if (commandName === 'profile') {
      await profileCommand.execute(interaction);
    }
  } catch (error) {
    console.error(`[interactionCreate] Command error (${commandName}):`, error);
    const reply = interaction.replied || interaction.deferred
      ? interaction.editReply.bind(interaction)
      : interaction.reply.bind(interaction);
    await reply({ content: 'エラーが発生しました。管理者に連絡してください。', ephemeral: true }).catch(() => {});
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  try {
    await verifyCommand.handleButton(interaction);
  } catch (error) {
    console.error('[interactionCreate] Button error:', error);
    await interaction.reply({ content: 'エラーが発生しました。管理者に連絡してください。', ephemeral: true }).catch(() => {});
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    await verifyCommand.handleModalSubmit(interaction);
  } catch (error) {
    console.error('[interactionCreate] Modal error:', error);
    await interaction.reply({ content: 'エラーが発生しました。管理者に連絡してください。', ephemeral: true }).catch(() => {});
  }
}
