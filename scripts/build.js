const registry = require('package-stream')()
const ora = require('ora')
const spinner = ora('Loading').start()
const parseGitHubUrl = require('github-url-to-object')
const isUrl = require('is-url')
const repos = {}
var totalPackages = 0

registry
  .on('package', (pkg) => {
    spinner.text = String(++totalPackages)
    if (!pkg || !pkg.name || !pkg.repository) return

    const repo = (pkg.repository.url) ? pkg.repository.url : pkg.repository
    const parsed = parseGitHubUrl(repo)

    if (parsed) {
      repos[pkg.name] = parsed.https_url
    } else if (isUrl(repo)) {
      repos[pkg.name] = repo
    }

    if (totalPackages>100) return done()
  })
  .on('up-to-date', done)


function done() {
  process.stderr.write('\ndone!\n')
  process.stdout.write(JSON.stringify(repos, null, 2))
  process.exit()
}