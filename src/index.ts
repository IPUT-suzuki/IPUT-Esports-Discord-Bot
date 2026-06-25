import 'dotenv/config';
import process from 'node:process';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import guildMemberAddHandler from './handlers/guildMemberAdd.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on(Events.GuildMemberAdd, guildMemberAddHandler);

client.on('error', (error) => {
  console.error('[Client Error]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

client.login(process.env.DISCORD_TOKEN);
