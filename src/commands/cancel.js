import { activeDownloads, cancelledTasks } from '../handlers/downloadManager.js';
import { logger } from '../utils/logger.js';
let logs = null;
try { logs = await import('../logs.js'); } catch {}

export async function handleCancel(interaction) {
  const taskId = interaction.options.getString('task-id');
  const userId = interaction.user.id;

  const download = activeDownloads.get(taskId);

  if (!download) {
    await interaction.reply({
      content: `No active download found with task ID \`${taskId}\`.`,
      ephemeral: true,
    });
    return;
  }

  if (download.userId !== userId) {
    await interaction.reply({
      content: 'You can only cancel your own downloads.',
      ephemeral: true,
    });
    return;
  }

  cancelledTasks.add(taskId);
  logger.cancel(download.username, taskId);
  logs?.logCancel({ taskId, userId, username: download.username, url: download.url, isDM: !interaction.guild, guildId: interaction.guildId ?? null, guildName: interaction.guild?.name ?? null, channelId: interaction.channelId ?? null });
  download.stop();
  try {
    download.process.kill('SIGTERM');
  } catch {
    download.process.kill();
  }

  activeDownloads.delete(taskId);

  await interaction.reply({
    content: `Cancelled download \`${taskId}\`.`,
    ephemeral: true,
  });
}
