const fs = require('fs')
const urlParser = require('url')
const path = require('path')
const events = require('events')
const EventEmitter = events.EventEmitter

const debug = require('debug')('update')
const isUrl = require('is-url')

const got = require('got').default.extend({
  headers: {
    'npm-replication-opt-in': 'true' // See https://github.com/orgs/community/discussions/152515
  },
  timeout: {
    request: 60 * 1000
  }
})

const to = {
  github: require('github-url-to-object'),
  bitbucket: require('bitbucket-url-to-object')
}

const replicateUrl = 'https://replicate.npmjs.com/registry'
const registryUrl = 'https://registry.npmjs.org'

events.setMaxListeners(Infinity)

/**
 * Where the support files are stored
 */
const files = {
  packages: path.join(__dirname, '../data/packages.json'),
  metadata: path.join(__dirname, '../data/metadata.json')
}

const packages = new Map(fs.existsSync(files.packages) ? Object.entries(require(files.packages)) : [])
const metadata = fs.existsSync(files.metadata) ? require(files.metadata) : {}
metadata.notFound = new Map(metadata.notFound)

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
  ignored: 0,
  // 404 response from the registry; most likely deleted in a later change
  notFound: 0
}

/**
 * Stats about the repos
 */
const repos = {
  unsets: 0,
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
  delay: 1000 * 60 * 5,
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

const setupBatch = async () => {
  const remoteMeta = await got(`${replicateUrl}/`).json()

  // 1. was the previous ran an error?

  if (metadata.error) {
    const previousLimit = (metadata.batch &&
                          metadata.batch.limit) ||
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

  batch.latest = remoteMeta.update_seq
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
 * @param {number} [spaces] default 2 spaces
 *
 * @return {string}
 */
const toJson = (object, spaces = 2) => {
  return JSON.stringify(object, null, spaces)
}

/**
 * @param {Map<string, string | null>} packagesMap
 * @return {object}
 */
const toSortedObject = (packagesMap) => {
  const sorted = {}
  const keys = [...packagesMap.keys()].sort()

  for (const key of keys) {
    sorted[key] = packagesMap.get(key)
    packagesMap.delete(key)
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
      repository: change.doc && change.doc.repository
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
  const curr = packages.get(name)

  // We got a valid change => delete records of any previous errors for the package.
  if (metadata.notFound.has(change.id)) {
    stats.notFound -= 1
    metadata.notFound.delete(change.id)
    debug('deleting previous error for', name, change)
  }

  if (change.deleted) {
    if (typeof curr !== 'undefined') {
      updateRepoStats(curr, -1)
    }

    stats.deletes += 1
    return packages.delete(name)
  }

  const changeUrl = extractUrl(change)
  const parsedUrl = parseUrl(changeUrl) || null

  if (changeUrl && !parsedUrl) {
    stats.invalid += 1
    return
  }

  if (typeof curr === 'undefined') {
    stats.inserts += 1
  } else {
    stats.updates += 1
    updateRepoStats(curr, -1)
  }

  packages.set(name, parsedUrl)
  updateRepoStats(parsedUrl, +1)
}

/**
 * @return {string} - repo url
 */
const extractUrl = (change) => {
  const repo = change.doc && change.doc.repository

  return typeof repo === 'string'
    ? repo
    : repo && repo.url
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

const parseUrl = (url) => {
  if (typeof url !== 'string') {
    return
  }

  for (const parse of URL_PARSERS) {
    try {
      const result = parse(url)
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
  if (url === null) {
    return 'unsets'
  }

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
    // eslint-disable-next-line n/no-deprecated-api
    const { hostname } = urlParser.parse(repoUrl)
    return hostname.replace(/^www\./i, '')
  } catch (err) {
    // empty
  }
}

const updateRepoStats = (url, delta) => {
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

  metadata.packages = packages.size
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

  fs.writeFileSync(files.metadata, toJson({ ...metadata, notFound: Array.from(metadata.notFound) }))

  if (batch.found > 0) {
    fs.writeFileSync(files.packages, toJson(toSortedObject(packages)))
  }

  writeReadme()
  writeCache()

  err
    ? deferred.reject(err)
    : deferred.resolve()
}

const writeCache = () => {
  if (!caches.path) {
    return // cache is disabled
  }

  if (!caches.buffer || caches.buffer.length === 0) {
    return // empty cache
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

const writeReadme = () => {
  if (!batch.found) {
    return // not new changes
  }

  const tpl = require('../lib/stats-tpl')

  const readmeFile = path.join(__dirname, '../readme.md')
  const readme = fs
    .readFileSync(readmeFile, 'utf8')
    .replace(tpl.regex, tpl.build(metadata))

  fs.writeFileSync(readmeFile, readme)
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

const wait = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const backoff = async (retry) => {
  const bo = Math.min(Math.pow(retry + 1, 3) * 1000, 60 * 1000)
  debug('retrying (', retry, '), waiting for', bo)
  await wait(bo)
}

const asyncQueue = async function * (items, executor, { concurrency }) {
  const waiting = []

  for (const item of items) {
    waiting.push(executor(item))

    if (waiting.length >= concurrency) {
      yield await waiting.shift()
    }
  }

  for (const item of waiting) {
    yield await item
  }
}

class Follower extends EventEmitter {
  constructor ({ since, limit }) {
    super()
    this.since = since
    this.limit = limit
    this.abortController = null
  }

  start () {
    if (this.abortController) {
      return this
    }

    this.abortController = new AbortController()
    this.startInternal().catch(console.error)
    return this
  }

  async startInternal () {
    const signal = this.abortController.signal
    let retry = 0

    while (!signal.aborted && this.limit > 0) {
      try {
        const body = await got(
          `${replicateUrl}/_changes`,
          {
            timeout: {
              request: 5 * 60 * 1000
            },
            searchParams: {
              since: this.since,
              limit: Math.min(this.limit, 10000)
            },
            retry: {
              limit: 0
            },
            signal
          }
        ).json()

        retry = 0

        if (body.last_seq) {
          this.since = body.last_seq
        }

        if (body.results) {
          const lazyResults = asyncQueue(body.results, (change) => {
            // Don't attempt to fetch the doc for deleted packages.
            if (change.deleted) {
              return change
            }

            return got(`${registryUrl}/${change.id}`, {
              retry: {
                limit: 10
              },
              signal
            }).json().then((doc) => {
              return { ...change, doc }
            }).catch((error) => {
              return { ...change, error }
            })
          }, { concurrency: 40 })

          // The async generator ensures we process the changes in the right order,
          // while making multiple registry fetches in parallel.
          for await (const result of lazyResults) {
            if (signal.aborted) {
              break
            }

            if (result.error) {
              this.emit('error', result.error, result)
            } else {
              this.emit('change', result)
            }

            this.limit -= 1
          }

          debug(`processed ${body.results.length} changes`)
        }
      } catch (e) {
        debug('[error]', e)

        if (!signal.aborted) {
          await backoff(++retry)
        }
      }
    }

    if (this.limit <= 0) {
      this.emit('catchup')
    }

    this.abortController = null
  }

  stop () {
    this.abortController?.abort()
    this.emit('stop')
  }
}

/**
 * Main
 */
// eslint-disable-next-line no-unused-expressions
!(async () => {
  await setupBatch()
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
    since: batch.since
  }

  if (batch.limit > 0 && Number.isFinite(batch.limit)) {
    request.limit = batch.limit
  }

  const feed = new Follower(request)

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

  feed.on('error', (err, maybeChange) => {
    if (err?.response?.statusCode === 404 && maybeChange?.seq && maybeChange?.id) {
      const seqs = metadata.notFound.get(maybeChange.id) || []

      if (!seqs.length) {
        stats.notFound += 1
      }

      seqs.push(maybeChange.seq)
      metadata.notFound.set(maybeChange.id, seqs)
      debug(`ignoring 404 for ${maybeChange?.id} (${maybeChange?.seq})`)
      return
    }

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
