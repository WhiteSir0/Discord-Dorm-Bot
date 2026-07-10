const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERROR' };

export function log(level, ...args) {
  const ts = new Date().toISOString();
  const tag = LEVELS[level] ?? 'INFO';
  const out = level === 'error' ? console.error : console.log;
  out(`[${ts}] [${tag}]`, ...args);
}
