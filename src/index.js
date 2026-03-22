import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} from 'discord.js';
import { DISCORD_TOKEN } from './config.js';
import { checkDependencies, cleanupDownloadsDir } from './utils/cleanup.js';
import { logger } from './utils/logger.js';

import { handleMessage } from './handlers/messageHandler.js';
import { handleDownload } from './commands/download.js';
import { handleUpload } from './commands/upload.js';
import { handleQueue } from './commands/queue.js';
import { handleCancel } from './commands/cancel.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', async () => {
  logger.bot(`Logged in as ${client.user.tag}`);
  await cleanupDownloadsDir();
  await checkDependencies();

  client.user.setPresence({
    activities: [{ name: 'download anything', type: ActivityType.Custom }],
    status: 'online',
  });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'yt-dlp') {
      await handleDownload(interaction);
    } else if (interaction.commandName === 'upload') {
      await handleUpload(interaction);
    } else if (interaction.commandName === 'queue') {
      await handleQueue(interaction);
    } else if (interaction.commandName === 'cancel') {
      await handleCancel(interaction);
    }
  } catch (err) {
    logger.error(`Interaction error: ${err.message}`);
    const reply = { content: 'An unexpected error occurred.', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch {}
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  await handleMessage(message);
});

client.login(DISCORD_TOKEN);
