// Corre `react-scripts build` con la release inyectada como REACT_APP_SENTRY_RELEASE,
// y (si hay credenciales) sube los sourcemaps a Sentry y borra los .map del bundle publico.
//
// Env vars requeridas para subir sourcemaps (opcional; si faltan, solo se hace build):
//   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
// Release: VERCEL_GIT_COMMIT_SHA (lo inyecta Vercel) o SENTRY_RELEASE, o git HEAD como fallback.

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const env = { ...process.env };

const release =
  env.VERCEL_GIT_COMMIT_SHA ||
  env.SENTRY_RELEASE ||
  (() => { try { return execSync('git rev-parse HEAD').toString().trim(); } catch { return ''; } })();

if (release) env.REACT_APP_SENTRY_RELEASE = release;

const isWin = process.platform === 'win32';
execSync(isWin ? 'react-scripts.cmd build' : 'react-scripts build', { stdio: 'inherit', env });

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = env;
const buildDir = 'build/static';

if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT || !release) {
  console.log('[sentry] skip upload (falta SENTRY_AUTH_TOKEN/ORG/PROJECT o release SHA)');
  process.exit(0);
}
if (!existsSync(buildDir)) {
  console.log('[sentry] skip upload (no existe build/static)');
  process.exit(0);
}

const cli = `npx --yes @sentry/cli@2`;
const flags = `--org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`;
const run = c => execSync(c, { stdio: 'inherit', env });

run(`${cli} releases new ${release} ${flags}`);
run(`${cli} sourcemaps upload --release=${release} ${flags} --url-prefix "~/static" ${buildDir}`);
run(`${cli} releases finalize ${release} ${flags}`);

// Borra los .map del bundle publico para no exponer el codigo original al mundo.
function rmMaps(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) rmMaps(p);
    else if (name.endsWith('.map')) rmSync(p);
  }
}
rmMaps(buildDir);
console.log(`[sentry] sourcemaps subidos a release ${release} y .map borrados del bundle`);
