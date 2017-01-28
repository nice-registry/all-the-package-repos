const registry = require('package-stream')({
  db: 'https://replicate.npmjs.com'
})
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

    // normalize github url _strings_ to https format
    if (typeof pkg.repository === 'string') {
      gho = gh(pkg.repository)
      repos[pkg.name] = gho ? gho.https_url : pkg.repository
      return
    }

    // normalize github url _objects_ to https format
    if (pkg.repository.url) {
      gho = gh(pkg.repository.url)
      repos[pkg.name] = gho ? gho.https_url : pkg.repository.url
      return
    }
  })
  .on('up-to-date', function () {
    const urls = Object.keys(repos).map(name => repos[name])
    console.error(`\n${totalPackages} packages total`)
    console.error(`${urls.length} packages with a repository`)
    console.error(`${urls.filter(url => url.match('github.com')).length} packages with a github repository`)
    process.stdout.write(JSON.stringify(repos, null, 2))
    process.exit()
  })
