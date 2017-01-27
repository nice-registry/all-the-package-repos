const registry = require('all-the-packages')
const gh = require('github-url-to-object')
const repos = {}
var totalPackages = 0

registry
  .on('package', function (pkg) {
    totalPackages++

    process.stderr.write('.')
    if (!pkg) return
    if (!pkg.name) return
    if (!pkg.repository) return

    var repo
    var gho

    if (typeof pkg.repository === 'string') {
      gho = gh(pkg.repository)
      repos[pkg.name] = gho ? gho.https_url : pkg.repository
      return
    }

    if (pkg.repository.url) {
      gho = gh(pkg.repository.url)
      repos[pkg.name] = gho ? gho.https_url : pkg.repository.url
      return
    }
  })
  .on('end', function () {
    const urls = Object.keys(repos).map(name => repos[name])
    console.error(`${totalPackages} packages in the npm registry`)
    console.error(`${urls.length} packages with a repository`)
    console.error(`${urls.filter(url => url.match('github.com')).length} packages with a github repository`)
    process.stdout.write(JSON.stringify(repos, null, 2))
  })
