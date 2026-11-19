import { readFile, writeFile } from 'node:fs/promises';

// Configure only this project's known maintenance job; never touch other jobs.
const endpoint = 'https://the-browser-one.vercel.app/api/premium/access/expire/run';
async function main() {
  const key = process.env.CRONJOB_API_KEY ?? process.env.CRONJOB_API__KEY;
  const secretFile = process.env.PREMIUM_ACCESS_CRON_SECRET_FILE;
  if (!key || !secretFile) throw new Error('Configurer la clé cron-job.org et le fichier sécurisé du secret de maintenance.');
  const secret = (await readFile(secretFile, 'utf8')).trim();
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Le secret de maintenance doit être la valeur réelle générée, pas un marqueur cloud.');
  async function api(path, method = 'GET', payload) {
    const response = await fetch(`https://api.cron-job.org${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (!response.ok) throw new Error(`API cron-job.org HTTP ${response.status} ; configuration non confirmée.`);
    return response.json();
  }
  const probe = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${secret}` } });
  if (!probe.ok) throw new Error(`Contrôle préalable de maintenance HTTP ${probe.status}.`);
  const checked = await probe.json();
  if (!checked.complete || checked.failed !== 0) throw new Error('Le contrôle préalable doit être terminé sans erreur.');
  const listed = await api('/jobs');
  if (listed.someFailed || !Array.isArray(listed.jobs)) throw new Error('Liste des tâches incomplète.');
  const matches = listed.jobs.filter(job => job.url === endpoint);
  if (matches.length > 1) throw new Error('Plusieurs tâches pour cette URL : intervention nécessaire pour éviter un doublon.');
  const job = {
    title: 'The Browser — expiration Premium', url: endpoint, enabled: true,
    requestMethod: 1, requestTimeout: 300, saveResponses: true, redirectSuccess: false,
    extendedData: { headers: { Authorization: `Bearer ${secret}` }, body: '' },
    schedule: { timezone: 'UTC', expiresAt: 0, hours: [-1], mdays: [-1], minutes: Array.from({ length: 12 }, (_, i) => i * 5), months: [-1], wdays: [-1] },
    notification: { onFailure: true, onFailureCount: 1, onSuccess: true, onDisable: true, onSslCertExpiry: true, onSslCertExpirySeconds: 604800, mode: 2, selectedChannels: [0] },
  };
  let jobId = matches[0]?.jobId;
  if (jobId) await api(`/jobs/${jobId}`, 'PATCH', { job });
  else jobId = (await api('/jobs', 'PUT', { job })).jobId;
  if (!Number.isSafeInteger(jobId)) throw new Error('Identifiant de tâche invalide.');
  const { jobDetails: saved } = await api(`/jobs/${jobId}`);
  if (saved.url !== endpoint || !saved.enabled || saved.requestMethod !== 1 || saved.extendedData?.headers?.Authorization !== `Bearer ${secret}` ||
      JSON.stringify(saved.schedule.minutes) !== JSON.stringify(job.schedule.minutes)) throw new Error('La configuration relue ne correspond pas à celle demandée.');
  const result = { jobId, enabled: saved.enabled, requestMethod: 'POST', intervalMinutes: 5, timeoutSeconds: saved.requestTimeout, nextExecution: saved.nextExecution };
  if (process.env.PREMIUM_SCHEDULER_RECEIPT) await writeFile(process.env.PREMIUM_SCHEDULER_RECEIPT, JSON.stringify(result), { mode: 0o600 });
  console.log(JSON.stringify(result));
}
main().catch(() => { console.error('Configuration du contrôle Premium interrompue ; vérifier accès, secret, quota et historique sans afficher les credentials.'); process.exitCode = 1; });
