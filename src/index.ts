import 'dotenv/config';
import process from 'node:process';
import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import guildMemberAddHandler from './handlers/guildMemberAdd.js';
import interactionCreateHandler from './handlers/interactionCreate.js';
import messageCreateHandler from './handlers/messageCreate.js';
import voiceStateUpdateHandler from './handlers/voiceStateUpdate.js';
import { data as verifyData } from './commands/verify.js';
import { data as profileData } from './commands/profile.js';
import { data as unverifyData } from './commands/unverify.js';
import { startLeaderboardUpdater } from './utils/leaderboard.js';
import { initActivityBuffer, startAutoFlush, stopAutoFlush, flushActivityData } from './utils/activity.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Ready] Logged in as ${readyClient.user.tag}`);

  await initActivityBuffer();
  startAutoFlush(10000);
  startLeaderboardUpdater(client);

  // スラッシュコマンドを登録
  const token = process.env.DISCORD_TOKEN;
  const clientId = readyClient.user.id;
  if (!token) {
    console.error('[Error] DISCORD_TOKEN is not set');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('[Commands] Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), {
      body: [verifyData.toJSON(), profileData.toJSON(), unverifyData.toJSON()],
    });
    console.log('[Commands] Slash commands registered successfully');
  } catch (error) {
    console.error('[Commands] Failed to register slash commands:', error);
  }
});

client.on(Events.GuildMemberAdd, guildMemberAddHandler);
client.on(Events.InteractionCreate, interactionCreateHandler);
client.on(Events.MessageCreate, messageCreateHandler);
client.on(Events.VoiceStateUpdate, voiceStateUpdateHandler);

client.on('error', (error) => {
  console.error('[Client Error]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] Flushing activity data...');
  stopAutoFlush();
  await flushActivityData();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
