import 'dotenv/config';
import process from 'node:process';
import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import guildMemberAddHandler from './handlers/guildMemberAdd.js';
import interactionCreateHandler from './handlers/interactionCreate.js';
import { data as verifyData } from './commands/verify.js';
import { data as profileData } from './commands/profile.js';
import { data as rankData } from './commands/rank.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Ready] Logged in as ${readyClient.user.tag}`);

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
      body: [verifyData.toJSON(), profileData.toJSON(), rankData.toJSON()],
    });
    console.log('[Commands] Slash commands registered successfully');
  } catch (error) {
    console.error('[Commands] Failed to register slash commands:', error);
  }
});

client.on(Events.GuildMemberAdd, guildMemberAddHandler);
client.on(Events.InteractionCreate, interactionCreateHandler);

client.on('error', (error) => {
  console.error('[Client Error]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

client.login(process.env.DISCORD_TOKEN);
