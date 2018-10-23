const fs = require('fs')
const path = require('path')
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

    if (totalPackages > 500 * 1000) {
      console.log(pkg.name)
    }

    const repo = (pkg.repository.url) ? pkg.repository.url : pkg.repository
    let parsed
    
    try {
      parsed = parseGitHubUrl(repo)
    } catch (err) {
      console.error('unable to parse GitHub URL', repo)
      console.error(err)
    }

    if (parsed) {
      repos[pkg.name] = parsed.https_url
    } else if (isUrl(repo) && repo.startsWith('http')) {
      repos[pkg.name] = repo
    }

    // uncomment for debugging
    // if (totalPackages>1000) return done()
  })
  .on('up-to-date', done)

function done () {
  console.log('\ndone!')
  fs.writeFileSync(
    path.join(__dirname, '../index.json'),
    JSON.stringify(repos, null, 2)
  )
  process.exit()
}
