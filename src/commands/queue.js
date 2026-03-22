import { activeDownloads } from '../handlers/downloadManager.js';
import { createQueueEmbed } from '../utils/embedBuilder.js';

export async function handleQueue(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.tag;

  const userDownloads = [...activeDownloads.values()].filter((d) => d.userId === userId);
  const embed = createQueueEmbed(userDownloads, username);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
