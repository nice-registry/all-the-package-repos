const registry = require('package-stream')()
const ora = require('ora')
const spinner = ora('Loading').start()
const repos = {}
var totalPackages = 0

registry
  .on('package', function (pkg) {
    spinner.text = String(++totalPackages)
    if (!pkg || !pkg.name || !pkg.repository) return

    if (pkg.repository.url) {
      repos[pkg.name] = pkg.repository.url
    } else {
      repos[pkg.name] = pkg.repository
    }
  })
  .on('up-to-date', function () {
    process.stdout.write(JSON.stringify(repos, null, 2))
    process.exit()
  })
