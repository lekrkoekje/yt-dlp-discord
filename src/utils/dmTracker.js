import { writeFile, appendFile, readFile, mkdir } from 'fs/promises';

const FILE = './logs/messages.log';

async function ensureDir() {
  await mkdir('./logs', { recursive: true });
}

export async function trackMessage(channelId, messageId) {
  try {
    await ensureDir();
    await appendFile(FILE, `${channelId} ${messageId}\n`, 'utf8');
  } catch {}
}

export async function startupCleanup(client) {
  await ensureDir();

  let content = '';
  try { content = await readFile(FILE, 'utf8'); } catch {}

  const lines = content.split('\n').filter((l) => l.trim());

  // Clear the file before deleting so it starts fresh regardless of outcome
  await writeFile(FILE, '', 'utf8');

  let deleted = 0;
  for (const line of lines) {
    const [channelId, messageId] = line.trim().split(' ');
    if (!channelId || !messageId) continue;
    try {
      const channel = await client.channels.fetch(channelId);
      const msg = await channel.messages.fetch(messageId);
      await msg.delete();
      deleted++;
      await new Promise((r) => setTimeout(r, 400));
    } catch {}
  }

  return deleted;
}
