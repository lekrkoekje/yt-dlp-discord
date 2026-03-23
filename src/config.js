import 'dotenv/config';

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const CLIENT_ID = process.env.CLIENT_ID;
export const DOWNLOADS_DIR = './downloads';
export const LOG_UPDATE_INTERVAL = 2500;
export const MAX_LOG_LINES = 30;
export const RAM_QUEUE_THRESHOLD = parseInt(process.env.RAM_QUEUE_THRESHOLD ?? '85');
export const BANDWIDTH_QUEUE_THRESHOLD_MBPS = parseFloat(process.env.BANDWIDTH_QUEUE_THRESHOLD_MBPS ?? '50');
