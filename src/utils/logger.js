// ANSI color codes
const c = {
  reset:   '\x1b[0m',
  dim:     '\x1b[2m',
  bold:    '\x1b[1m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
};

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const TAG_WIDTH = 6;

function centerTag(tag) {
  const pad = TAG_WIDTH - tag.length;
  const l = Math.floor(pad / 2);
  const r = pad - l;
  return ' '.repeat(l) + tag + ' '.repeat(r);
}

function line(color, tag, msg) {
  return `${c.dim}[${ts()}]${c.reset} ${color}${c.bold}[${centerTag(tag)}]${c.reset} ${msg}`;
}

function fmtUser(username) {
  return `${c.bold}${c.white}${username}${c.reset}`;
}

function fmtServer(name) {
  return `${c.magenta}${name}${c.reset}`;
}

function fmtId(id) {
  return `${c.dim}[${id}]${c.reset}`;
}

function fmtUrl(u) {
  const short = u.length > 55 ? u.slice(0, 52) + '...' : u;
  return `${c.dim}${c.cyan}${short}${c.reset}`;
}

function fmtLocation(isDM, guildName, guildId, channelId) {
  if (isDM) return `${c.blue}DM${c.reset}`;
  const name = guildName ?? guildId ?? '?';
  const ch   = channelId ? ` ${c.dim}#${channelId}${c.reset}` : '';
  return `${fmtServer(name)}${ch}`;
}

export const logger = {
  bot(msg) {
    console.log(line(c.cyan, 'BOT', msg));
  },

  queue(username, type, isDM, guildName, guildId, channelId) {
    const loc = fmtLocation(isDM, guildName, guildId, channelId);
    console.log(line(c.yellow, 'QUEUE', `${fmtUser(username)} queued ${c.yellow}${type}${c.reset} in ${loc}`));
  },

  start(username, taskId, url) {
    console.log(line(c.blue, 'START', `${fmtUser(username)} ${fmtId(taskId)} ${fmtUrl(url)}`));
  },

  success(username, taskId, fileName, sizeMB, uploadUrl) {
    console.log(line(c.green, 'DONE', `${fmtUser(username)} ${fmtId(taskId)} ${c.green}${fileName}${c.reset} (${sizeMB} MB) ${c.dim}→${c.reset} ${c.cyan}${uploadUrl}${c.reset}`));
  },

  failure(username, taskId, exitCode) {
    console.log(line(c.red, 'FAIL', `${fmtUser(username)} ${fmtId(taskId)} ${c.red}exit ${exitCode}${c.reset}`));
  },

  upload(username, taskId, fileName, sizeMB, uploadUrl, isDM, guildName, guildId, channelId) {
    const loc = fmtLocation(isDM, guildName, guildId, channelId);
    console.log(line(c.green, 'UPLOAD', `${fmtUser(username)} ${fmtId(taskId)} ${c.green}${fileName}${c.reset} (${sizeMB} MB) ${c.dim}→${c.reset} ${c.cyan}${uploadUrl}${c.reset} in ${loc}`));
  },

  cancel(username, taskId) {
    console.log(line(c.magenta, 'CANCEL', `${fmtUser(username)} cancelled ${fmtId(taskId)}`));
  },

  clean(msg) {
    console.log(line(c.dim, 'CLEAN', `${c.dim}${msg}${c.reset}`));
  },

  info(msg) {
    console.log(line(c.cyan, 'INFO', msg));
  },

  warn(msg) {
    console.log(line(c.yellow, 'WARN', `${c.yellow}${msg}${c.reset}`));
  },

  error(msg) {
    console.log(line(c.red, 'ERROR', `${c.red}${msg}${c.reset}`));
  },
};
