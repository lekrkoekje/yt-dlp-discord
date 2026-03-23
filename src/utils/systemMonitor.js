import { freemem, totalmem } from 'os';
import { readFile } from 'fs/promises';
import { spawn } from 'child_process';
import { RAM_QUEUE_THRESHOLD, BANDWIDTH_QUEUE_THRESHOLD_MBPS } from '../config.js';

export function getMemUsagePct() {
  return (1 - freemem() / totalmem()) * 100;
}

let bandwidthMbps = 0;
let lastNetSample = null;

async function getNetworkBytes() {
  if (process.platform === 'linux') {
    try {
      const data = await readFile('/proc/net/dev', 'utf8');
      let total = 0;
      for (const line of data.split('\n').slice(2)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10 || parts[0] === 'lo:') continue;
        total += parseInt(parts[1]) + parseInt(parts[9]); // rx + tx bytes
      }
      return total;
    } catch { return null; }
  }

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const ps = spawn('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        '(Get-NetAdapterStatistics | Measure-Object ReceivedBytes,SentBytes -Sum).Sum',
      ]);
      let out = '';
      ps.stdout.on('data', (d) => { out += d.toString(); });
      ps.on('close', () => { const n = parseFloat(out.trim()); resolve(isNaN(n) ? null : n); });
      ps.on('error', () => resolve(null));
      setTimeout(() => { try { ps.kill(); } catch {} resolve(null); }, 3000);
    });
  }

  return null;
}

export async function startBandwidthMonitor() {
  const bytes = await getNetworkBytes();
  if (bytes !== null) lastNetSample = { time: Date.now(), bytes };

  setInterval(async () => {
    const bytes = await getNetworkBytes();
    if (bytes === null || lastNetSample === null) return;
    const dt = (Date.now() - lastNetSample.time) / 1000;
    if (dt <= 0) return;
    const deltaMB = (bytes - lastNetSample.bytes) / 1024 / 1024;
    bandwidthMbps = Math.max(0, (deltaMB * 8) / dt);
    lastNetSample = { time: Date.now(), bytes };
  }, 2000);
}

export function getBandwidthMbps() {
  return bandwidthMbps;
}

// Returns a reason string if resources are too tight, null if fine to start.
export function checkResources(isLive) {
  const ramPct = getMemUsagePct();
  if (ramPct > RAM_QUEUE_THRESHOLD) {
    return `RAM at ${ramPct.toFixed(0)}% (limit: ${RAM_QUEUE_THRESHOLD}%)`;
  }
  if (isLive && bandwidthMbps > BANDWIDTH_QUEUE_THRESHOLD_MBPS) {
    return `bandwidth at ${bandwidthMbps.toFixed(0)} Mbps (limit: ${BANDWIDTH_QUEUE_THRESHOLD_MBPS} Mbps)`;
  }
  return null;
}
