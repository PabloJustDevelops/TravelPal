// Supervisor del servidor de e2e.
//
// Motivo: `wrangler dev` puede morir a mitad del suite con `Error inside ProxyWorker /
// Network connection lost` (fallo abierto de cloudflare/workers-sdk#15203: al responder
// a peticiones cuyo cuerpo no se drena, o que el cliente corta a mitad, el ProxyWorker
// muere y el proceso termina). Playwright no reinicia un `webServer` que ha muerto, asi
// que todo lo que queda detras falla con ERR_CONNECTION_REFUSED y el deploy se bloquea.
//
// Este envoltorio relanza wrangler y, sobre todo, apaga el GRUPO de procesos completo:
// cuando wrangler muere, sus hijos (`wrangler-dist/cli.js` y `workerd`) sobreviven y se
// quedan con el puerto 3000, asi que reiniciar sin matarlos no sirve de nada.
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const serverPort = 3000
const maxRestarts = 10
const probeIntervalMs = 200
const probeTimeoutMs = 500
const failureThreshold = 10
const restartBackoffMs = 500
const shutdownTimeoutMs = 5_000
const killTimeoutMs = 2_000

const env = { ...process.env }
delete env.INSFORGE_API_KEY
delete env.E2E_USER_EMAIL
delete env.E2E_USER_PASSWORD

let stopping = false
let child
let childGroup
let childClosePromise
let activeStop
let restartCount = 0

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (message, level = 'info') => {
  const write = level === 'error' ? console.error : console.log
  write(`[${new Date().toISOString()}] [e2e-server] ${message}`)
}

async function isServerAvailable() {
  try {
    const response = await fetch(`http://127.0.0.1:${serverPort}/signin`, {
      signal: AbortSignal.timeout(probeTimeoutMs),
    })
    return response.status > 0
  } catch {
    return false
  }
}

async function getWorkerProcessIds(rootPid) {
  const pending = [rootPid]
  const workerIds = new Set()

  while (pending.length > 0) {
    const pid = pending.pop()

    try {
      const [commandLine, children] = await Promise.all([
        readFile(`/proc/${pid}/cmdline`, 'utf8'),
        readFile(`/proc/${pid}/task/${pid}/children`, 'utf8'),
      ])

      if (commandLine.includes('workerd') && commandLine.includes(`socket-addr=entry=127.0.0.1:${serverPort}`)) {
        workerIds.add(pid)
      }
      pending.push(...children.trim().split(/\s+/).filter(Boolean))
    } catch {
      // Un proceso puede terminar entre leer el padre y mirar /proc.
    }
  }

  return [...workerIds].sort()
}

// Un grupo vivo se detecta con la senal 0. EPERM significa "existe pero no es nuestro",
// que aqui no deberia pasar, pero cuenta como vivo para no dar por bueno un cierre falso.
function isGroupAlive(pgid) {
  try {
    process.kill(-pgid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

function signalGroup(pgid, signal) {
  if (!pgid) return
  try {
    process.kill(-pgid, signal)
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

async function waitForGroupExit(pgid, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isGroupAlive(pgid)) return true
    await sleep(50)
  }
  return !isGroupAlive(pgid)
}

// Cierra el grupo del ultimo hijo lanzado. No mira si el hijo directo sigue vivo a
// proposito: su muerte es justo el caso en que hay que matar a los nietos.
async function stopChild() {
  if (activeStop) return activeStop
  if (!childGroup) return

  const pgid = childGroup
  activeStop = (async () => {
    signalGroup(pgid, 'SIGTERM')
    if (await waitForGroupExit(pgid, shutdownTimeoutMs)) {
      log(`process group ${pgid} closed`)
      return
    }

    log(`process group ${pgid} ignored SIGTERM; sending SIGKILL`, 'error')
    signalGroup(pgid, 'SIGKILL')
    if (!(await waitForGroupExit(pgid, killTimeoutMs))) {
      log(`process group ${pgid} still alive after SIGKILL`, 'error')
    } else {
      log(`process group ${pgid} killed`)
    }
  })().finally(() => {
    childGroup = undefined
    activeStop = undefined
  })

  return activeStop
}

async function runServer() {
  while (!stopping) {
    log(`starting wrangler on 127.0.0.1:${serverPort} (restart ${restartCount}/${maxRestarts})`)

    child = spawn(
      process.execPath,
      ['node_modules/wrangler/bin/wrangler.js', 'dev', '--port', String(serverPort), '--ip', '127.0.0.1'],
      { env, stdio: 'inherit', detached: true },
    )
    childGroup = child.pid

    // Si el SIGTERM de Playwright llega justo entre el spawn y este punto, el grupo
    // quedaria fuera del cierre final: se apaga aqui.
    if (stopping) {
      await stopChild()
      break
    }

    let childExit
    let hasServed = false
    let consecutiveProbeFailures = 0
    let workerProcessIds = []
    childClosePromise = new Promise((resolve) => {
      child.once('error', (error) => resolve({ error }))
      child.once('close', (code, signal) => resolve({ code, signal }))
    })

    while (!stopping && !childExit) {
      childExit = await Promise.race([childClosePromise, sleep(probeIntervalMs).then(() => null)])
      if (childExit || stopping) break

      const currentWorkerProcessIds = await getWorkerProcessIds(child.pid)
      if (workerProcessIds.length > 0 && currentWorkerProcessIds.join(',') !== workerProcessIds.join(',')) {
        log(
          `workerd process changed (${workerProcessIds.join(',')} -> ${currentWorkerProcessIds.join(',')}); restarting wrangler`,
          'error',
        )
        childExit = { reason: 'workerd process changed' }
        break
      }
      workerProcessIds = currentWorkerProcessIds

      const available = await isServerAvailable()
      if (available) {
        if (!hasServed) log(`ready at http://127.0.0.1:${serverPort}`)
        hasServed = true
        consecutiveProbeFailures = 0
      } else if (hasServed) {
        consecutiveProbeFailures += 1
        if (consecutiveProbeFailures >= failureThreshold) {
          log('service unavailable; restarting wrangler', 'error')
          childExit = { reason: 'health check failed' }
        }
      }
    }

    if (stopping) break

    if (childExit?.error) {
      log(`wrangler failed to start: ${childExit.error.message}`, 'error')
    } else {
      log(
        `wrangler stopped (code=${childExit?.code ?? 'unknown'}, signal=${childExit?.signal ?? 'none'}${childExit?.reason ? `, ${childExit.reason}` : ''})`,
        'error',
      )
    }

    // Clave: se limpia el grupo aunque el hijo directo ya este muerto.
    await stopChild()

    if (restartCount >= maxRestarts) {
      log(`restart limit reached (${maxRestarts}); exiting`, 'error')
      process.exitCode = 1
      break
    }

    restartCount += 1
    log(`restarting in ${restartBackoffMs}ms (${restartCount}/${maxRestarts})`)
    await sleep(restartBackoffMs)
  }

  await stopChild()
  log('closed')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    log(`received ${signal}; shutting down`)
    void stopChild()
  })
}

// Ultimo recurso: si el proceso sale por una via no controlada, no dejar el grupo vivo.
process.on('exit', () => {
  if (childGroup) signalGroup(childGroup, 'SIGKILL')
})

await runServer()
