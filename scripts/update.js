const fs = require('fs')
const url = require('url')
const path = require('path')
const nano = require('nano')

const isUrl = require('is-url')
const to = {
  github: require('github-url-to-object'),
  bitbucket: require('bitbucket-url-to-object')
}

/**
 * Where the support files are stored
 */
const files = {
  packages: path.join(__dirname, '../data/packages.json'),
  metadata: path.join(__dirname, '../data/metadata.json')
}

const packages = fs.existsSync(files.packages) ? require(files.packages) : {}
const metadata = fs.existsSync(files.metadata) ? require(files.metadata) : {}

/**
 * State info about the changes being processed
 */
const batch = {
  status: 'init',
  // How many changes to apply during the process (or `<= 0` to disable)
  limit: process.env.BATCH_LIMIT * 1 || 0
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
  // wrong repo urls
  invalid: 0,
  // unable to process
  ignored: 0
}

/**
 * Stats about the repos
 */
const repos = {
  github: 0,
  gitlab: 0,
  bitbucket: 0,
  others: 0
}

/**
 * Cache changes to disk, for faster historical rebuild
 */
const caches = {

  // Directory to temporarily store changes, or `null` to disable
  path: process.env.CACHE_DIR
    ? path.resolve(process.env.CACHE_DIR)
    : null,

  // How many entries per file
  size: 10000,

  // process cached files when starting up
  allowRead: process.env.CACHE_READ === '1' || false,

  // write consumed files to the file system
  allowWrite: process.env.CACHE_WRITE === '1' || false
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

const millis = 1
const seconds = 1000 * millis
const minutes = 60 * seconds
const hours = 60 * minutes

/**
 * Maximum allowed run time
 */
const killAfter = process.env.KILL_AFTER_MILLIS * 1 || 5.75 * hours

const setupBatch = async (db) => {
  const relax = await db.relax()

  // 1. was the previous ran an error?

  if (metadata.error) {
    const previousLimit = metadata.batch &&
                          metadata.batch.limit ||
                          batch.limit

    if (previousLimit > 1) {
      // attempt only the problematic change
      batch.limit = 1
    } else {
      // whatever, skip the bad one
      metadata.ignored = metadata.ignored || []
      metadata.ignored.push(metadata.last)
      metadata.last += 1
      stats.ignored += 1
    }
  }

  // 2. setup batch limits
  batch.latest = relax.update_seq
  batch.index =
  batch.since = metadata.last || 0
  batch.until = Math.min(
    batch.limit > 0
      ? batch.since + batch.limit
      : Infinity
    ,
    batch.latest
  )

  // 3. prepare batch stats collection

  batch.started = new Date()
  batch.finished = false
  batch.took_ms = -1
  batch.found = 0

  if (!batch.limit || batch.limit <= 0 || !Number.isFinite(batch.limit)) {
    batch.limit = batch.until - batch.since
  }

  metadata.error = false
}

/**
 * @param {object} object
 * @param {string|integer} spaces [optional] default 2 spaces
 *
 * @return {string}
 */
const toJson = (object, spaces) => {
  return JSON.stringify(object, null, spaces || 2)
}

/**
 * @param {object} object
 * @return {object}
 */
const sort = (object) => {
  const sorted = {}
  const keys = Object.keys(object).sort()

  for (const key of keys) {
    sorted[key] = object[key]
    delete object[key]
  }

  return sorted
}

const cache = (change) => {
  if (!caches.path || !caches.allowWrite) {
    return // cache is disabled
  }

  const entry = {
    seq: change.seq,
    id: change.id
  }

  if (change.deleted) {
    entry.deleted = true
  } else {
    entry.doc = {
      repository: change.doc.repository
    }
  }

  caches.buffer = caches.buffer || []
  caches.buffer.push(entry)

  if (caches.buffer.length >= caches.size) {
    writeCache()
  }
}

/**
 *
 */
const apply = (change) => {
  batch.index = change.seq
  batch.found += 1

  stats.changes += 1

  const name = change.id
  const curr = packages[name]

  if (change.deleted) {
    updateRepoStats(curr, -1)

    stats.deletes += 1
    return delete packages[name]
  }

  // TODO: this must be simplified as soon as standard linter
  //  will get updated since it doesn't support ?? operator
  //  const url = extractUrl(change) ?? null
  let url = extractUrl(change)
  url = typeof url === 'string' ? url : null

  if (!url) {
    stats.invalid += 1
  }

  if (typeof curr === 'string') {
    updateRepoStats(curr, -1)
    stats.updates += 1
  } else {
    stats.inserts += 1
  }

  packages[name] = url
  updateRepoStats(url, +1)
}

/**
 * @return {string} - repo url
 */
const extractUrl = (change) => {
  const repo = change.doc &&
               change.doc.repository

  return repo && parseUrl(repo)
}

const urlToObject = (parse) => {
  return (url) => {
    const found = parse(url)
    return found && found.https_url
  }
}

const plainUrl = (url) => {
  if (isUrl(url) && url.startsWith('http')) {
    return url
  }
}

const URL_PARSERS = [
  urlToObject(to.github),
/* FIXME: disabled
  urlToObject(to.bitbucket),
// */
  plainUrl
]

const parseUrl = (repo) => {
  const url = typeof repo === 'string'
    ? repo
    : repo.url

  if (typeof url !== 'string') {
    return
  }

  for (const parse of URL_PARSERS) {
    try {
      let result = parse(url)
      if (result) return result
    } catch (err) {
      continue
    }
  }
}

const TYPES = [
  {
    name: 'github',
    rule: /^github\./
  },
  {
    name: 'gitlab',
    rule: /^gitlab\./
  },
  {
    name: 'bitbucket',
    rule: /^bitbucket\./
  }
]

const extractType = (url) => {
  const domain = extractDomain(url)

  if (domain) {
    for (const type of TYPES) {
      if (type.rule.test(domain)) {
        return type.name
      }
    }
  }

  return 'others'
}

const extractDomain = (repoUrl) => {
  try {
    const { hostname } = url.parse(repoUrl)
    return hostname.replace(/^www\./i, '')
  } catch (err) {
    // empty
  }
}

const updateRepoStats = (url, delta) => {
  if (typeof url !== 'string') {
    return
  }

  const type = extractType(url)
  repos[type] = (repos[type] || 0) + Math.sign(delta)
}

/**
 * @return {Error} - or `null` on normal exit
 */
const updateStats = () => {
  batch.finished = new Date()
  batch.took_ms = batch.finished - batch.started

  const status = buildStatus()

  metadata.packages = Object.keys(packages).length
  metadata.last = batch.index ||
                  batch.since

  metadata.latest = batch.latest

  metadata.runs = metadata.runs || {}
  metadata.runs.total = (metadata.runs.total || 0) + 1
  metadata.runs.status = metadata.runs.status || {}
  metadata.runs.status[status] = (metadata.runs.status[status] || 0) + 1

  metadata.repos = metadata.repos || {}
  metadata.stats = metadata.stats || {}
  metadata.batch = batch
  metadata.error = Boolean(batch.error)

  for (const key of Object.keys(stats)) {
    metadata.stats[key] = (metadata.stats[key] || 0) + stats[key]
  }

  for (const key of Object.keys(repos)) {
    metadata.repos[key] = (metadata.repos[key] || 0) + repos[key]
  }

  batch.status = status

  const err = batch.error

  delete batch.latest
  delete batch.error

  if (err instanceof Error) {
    return err
  }
}

const buildStatus = () => {
  if (batch.status) return batch.status
  if (batch.found === 0) {
    batch.error = true
    return 'empty'
  }
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
      console.log('applying changes...')
      return
    }

    const complete = 1 - (batch.until - batch.index) / batch.limit
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

const writeChanges = (deferred) => {
  console.log('writting changes...')

  const err = updateStats()

  fs.writeFileSync(files.metadata, toJson(metadata))

  if (batch.found > 0) {
    fs.writeFileSync(files.packages, toJson(sort(packages)))
  }

  writeCache()

  err ? deferred.reject(err)
      : deferred.resolve()
}

const writeCache = () => {
  if (!caches.path) {
    return // cache is disabled
  }

  if (!caches.buffer || caches.buffer.length === 0) {
    return  // empty cache
  }

  let next = caches.index || -1
  let file

  do {
    next += 1
    file = path.join(caches.path, `${next}.json`)
  } while (fs.existsSync(file))

  // using plain JSON.stringify to reduce file size
  fs.writeFileSync(file, toJson(caches.buffer, '\t'))

  caches.buffer.length = 0
  caches.index = next
}

const processCached = () => {
  if (!caches.path || !caches.allowRead) {
    return // cache is disabled
  }

  console.log('reading cache...')

  const changeList = []

  let files = 0
  let changes = 0

  for (const file of fs.readdirSync(caches.path)) {
    if (!/^\d+\.json$/.test(file)) {
      continue
    }

    files += 1

    const entries = require(
      path.join(caches.path, file)
    )

    for (const change of entries) {
      changes += 1
      if (batch.index < change.seq && change.seq <= batch.until) {
        changeList.push(change)
      }
    }
  }

  console.log(' -> found %d files', files)
  console.log(' -> found %d changes', changes)

  changeList.sort((a, b) => a.seq - b.seq)

  const added = new Map()

  for (const change of changeList) {
    if (added.has(change.seq)) {
      continue // ups, repeated cache entry
    }

    apply(change)

    batch.since = batch.index
    added.set(change.seq)
  }

  console.log(' -> added %d entries', batch.found)
}

/**
 * Main
 */
!(async () => {
  const db = nano('https://replicate.npmjs.com')

  await setupBatch(db)
  await processCached()

  console.log('batch:')
  console.log({
    limit: batch.limit,
    since: batch.since,
    index: batch.index,
    until: batch.until,
    started: batch.started
  })

  const request = {
    since: batch.since,
    include_docs: true,
    inactivity_ms: 1000 * 60 * 60,
    heartbeat: 1000 * 60 * 15
  }

  if (batch.limit > 0 && Number.isFinite(batch.limit)) {
    request.limit = batch.limit
  }

  const feed = await db
    .use('')
    .follow(request)

  feed.on('change', (change) => {
    cache(change)
    apply(change)

    printProgress()

    if (batch.index >= batch.until) {
      console.log('finish!')
      feed.stop()
    }
  })

  feed.on('catchup', () => {
    console.log('up to date!')
    feed.stop()
  })

  feed.on('restart', () => {
    console.log('restart!')
    batch.status = 'restart'
    batch.error = true
    feed.stop()
  })

  feed.on('timeout', () => {
    console.log('timeout!')
    batch.status = 'timeout'
    batch.error = true
    feed.stop()
  })

  feed.on('error', (err) => {
    console.log('error!')
    batch.status = 'error'
    batch.error = err
    feed.stop()
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
    const force = true
    printProgress(force)
  })

  setTimeout(() => {
    console.log('killed!')
    batch.error = true
    batch.status = 'killed'
    feed.stop()
  }, killAfter)

  const deferred = {}

  feed.once('stop', () => {
    writeChanges(deferred)
  })

  return new Promise((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
    feed.start()
  })
})().then(
  () => {
    console.log(metadata)
    process.exit(0)
  },
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
