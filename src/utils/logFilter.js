const PATTERNS = [
  /[A-Za-z]:\\Users\\[^\\/:*?"<>|\r\n ]+/g,
  /\/home\/[^\s/]+/g,
  /\/Users\/[^\s/]+/g,
  /\/root/g,
  /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n ]*/g,
  /\/(?:var|tmp|usr|etc|opt|mnt|srv|proc)\/[^\s]*/g,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  /(?:cookie|token|auth|session|key|secret|password|passwd|api[_-]?key)\s*[=:]\s*\S+/gi,
];

export function filterLogLine(line) {
  let out = line;
  out = out.replace(PATTERNS[0], '[path]');
  out = out.replace(PATTERNS[1], '[path]');
  out = out.replace(PATTERNS[2], '[path]');
  out = out.replace(PATTERNS[3], '[path]');
  out = out.replace(PATTERNS[4], '[path]');
  out = out.replace(PATTERNS[5], '[path]');
  out = out.replace(PATTERNS[6], '[redacted]');
  out = out.replace(PATTERNS[7], '[credentials redacted]');
  return out;
}
