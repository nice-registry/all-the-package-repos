const fs = require('fs')
const path = require('path')
const nano = require('nano')
const extractUrl = require('./url-parser')
const { toJson, sort } = require('./utils')

const db = nano('https://replicate.npmjs.com').use('registry')

/**
 * Maximum allowed run time
 */
const killAfter = 1000 * 60 * 60 * 5

/**
 * Where the support files are stored
 */
const files = {
  packages: path.join(__dirname, '../../data/packages.json'),
  metadata: path.join(__dirname, '../../data/metadata.json')
}

const packages = fs.existsSync(files.packages) ? require(files.packages) : {}
const metadata = fs.existsSync(files.metadata) ? require(files.metadata) : {}

/**
 * List of failed sequences
 * Usually these are a large changes failing to process in inactivity_ms interval
 */
const failedChanges = new Set()

/**
 * State info about the changes being processed
 */
const batch = {
  // How many changes to apply during the process (or `<= 0` to disable)
  since: 0,
  index: 0,
  until: 0
}

/**
 * Statistics gathered during the process
 */
const stats = {
  // revisions processed
  changes: 0,
  // operations executed
  inserts: 0,
  updates: 0,
  deletes: 0,
  // unable to process
  ignored: 0
}

/**
 * Display update progress animation
 */
const progress = {
  // minimum time to shown something (in millis)
  delay: 1000 * 60 * 15,
  // space between changes, range (0, 100)
  steps: 5.0,
  // min percent change
  scale: 0.01
}

/**
 * @param change
 * @return {boolean}
 */
const apply = (change) => {
  batch.index = change.seq
  batch.found += 1

  stats.changes += 1

  const name = change.id

  if (change.deleted) {
    stats.deletes += 1
    return delete packages[name]
  }

  stats[packages[name] !== undefined ? 'updates' : 'inserts'] += 1

  packages[name] = extractUrl(change) ?? null
}

/**
 * @return {Error} - or `null` on normal exit
 */
const updateStats = () => {
  batch.finished = new Date()
  batch.took_ms = batch.finished - batch.started

  const status = buildStatus()

  metadata.packages = Object.keys(packages).length
  metadata.last = batch.index || batch.since

  metadata.latest = batch.until

  metadata.runs = metadata.runs || {}
  metadata.runs.total = (metadata.runs.total || 0) + 1
  metadata.runs.status = metadata.runs.status || {}
  metadata.runs.status[status] = (metadata.runs.status[status] || 0) + 1

  metadata.stats = metadata.stats || {}

  metadata.batch = batch
  batch.status = status

  for (const key of Object.keys(stats)) {
    metadata.stats[key] = (metadata.stats[key] || 0) + stats[key]
  }

  // ignored
  const allIgnored = new Set(metadata.ignored || [])
  failedChanges.forEach((seq) => allIgnored.add(seq))
  metadata.ignored = [...allIgnored]

  const err = batch.error

  if (err) {
    metadata.error = true
  }

  delete batch.error
}

const setupBatch = async (db) => {
  const dbInfo = await db.info()

  // 1. setup batch limits

  batch.index = batch.since = metadata.last || 0
  batch.until = dbInfo.update_seq

  // 2. prepare batch stats collection

  batch.started = new Date()
  batch.finished = false
  batch.took_ms = -1
  batch.found = 0

  delete metadata.error
}

const buildStatus = () => {
  if (batch.status) return batch.status

  if (batch.found === 0) {
    metadata.error = true
    return 'empty'
  }

  delete metadata.error

  return 'ok'
}

const printProgress = (() => {
  // keeps track of the percent indicator
  let next = -1
  let time = 0

  // used for scale
  const mul = 1 / progress.scale * 100
  const div = mul / 100

  return (force) => {
    if (next < 0) {
      next = 0
      time = Date.now()
      return
    }

    const complete = 1 - (batch.until - batch.index) / (batch.until - batch.since)
    const percent = Math.round(complete * mul) / div
    const elapsed = Date.now() - time

    const hasAdvanced = percent >= next
    const hasTimedout = elapsed >= progress.delay

    if (force || hasAdvanced || hasTimedout) {
      next = percent + progress.steps
      time = Date.now()
      console.log('- %d%%', percent)
    }
  }
})()

const writeChanges = () => {
  updateStats()

  fs.writeFileSync(files.metadata, toJson(metadata))
  console.log('metadata written')

  if (batch.found > 0) {
    fs.writeFileSync(files.packages, toJson(sort(packages)))
    console.log('packages written')
  }
}

const readChanges = async (resolve, reject) => {
  let stopState = false
  let restartState = false

  await setupBatch(db)

  console.log('start processing batch:', {
    since: batch.since,
    until: batch.until,
    started: batch.started
  })

  const feed = db.follow({
    since: batch.since,
    include_docs: true,
    inactivity_ms: 1000 * 60 * 15,
    heartbeat: 1000 * 60 * 15
  })

  feed.on('change', (change) => {
    failedChanges.delete(change.seq)

    apply(change)
    printProgress()

    if (batch.index >= batch.until) {
      console.log('finish!')
      feed.stop()
    }
  })

  feed.on('start', () => {
    stopState = false
    restartState = false
  })

  feed.on('catchup', () => {
    console.log('up to date!')
    feed.stop()
  })

  feed.on('restart', () => {
    restartState = true

    if (failedChanges.has(batch.index)) {
      console.log('sequence skipped', batch.index)
      feed.since = ++batch.index
      stats.ignored += 1
      return
    }

    failedChanges.add(batch.index)
    console.log('fetching restarted on sequence', batch.index)
  })

  feed.on('timeout', () => {
    batch.status = 'timeout'
    batch.error = new Error('Connection to the DB is timed out')
    feed.stop()
  })

  feed.on('error', (error) => {
    batch.status = 'error'
    batch.error = error
    feed.stop()
  })

  feed.on('stop', () => {
    if (stopState) {
      return
    }

    writeChanges()
    batch.found = 0

    const error = batch.error
    stopState = true

    if (error instanceof Error) {
      reject(error)
    }

    if (!restartState) {
      resolve(metadata)
    }
  })

  process.once('SIGTERM', () => {
    console.log('cancelled!')
    batch.status = 'cancelled'
    feed.stop()
  })

  process.once('SIGINT', () => {
    console.log('cancelled!')
    batch.status = 'cancelled'
    feed.stop()
  })

  process.on('SIGUSR1', () => {
    printProgress(true)
    console.log('current sequence', batch.index)
  })

  setTimeout(() => {
    batch.status = 'killed'
    feed.stop()
  }, killAfter)

  printProgress()
  feed.follow()
}

module.exports = () => {
  return new Promise((resolve, reject) => {
    return readChanges(resolve, reject)
  })
}
