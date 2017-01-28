const registry = require('package-stream')({
  db: 'https://replicate.npmjs.com'
})
const ora = require('ora')
const spinner = ora('Loading').start()
const repos = {}
var totalPackages = 0

registry
  .on('package', function (pkg) {
    spinner.text = String(++totalPackages)
    if (!pkg || !pkg.name || !pkg.repository) return
    repos[pkg.name] = pkg.repository
  })
  .on('up-to-date', function () {
    process.stdout.write(JSON.stringify(repos, null, 2))
    process.exit()
  })
