const repos = require('.')
const packages = require('all-the-package-names')
const urls = Object.values(repos)
const github = urls.filter(url => (/github\.com/i).test(url))
const bitbucket = urls.filter(url => (/bitbucket\.org/i).test(url))
const gitlab = urls.filter(url => (/gitlab\.com/i).test(url))

function percentage (collection) {
  return (collection.length / packages.length * 100).toFixed(2) + '%'
}

console.log(`
Packages | Count | Percentage of Total Packages
---- | ----- | ----------
All | ${packages.length} | 100%
With repository in package.json | ${urls.length} | ${percentage(urls)}
On GitHub | ${github.length} |  ${percentage(github)}
On BitBucket | ${bitbucket.length} |  ${percentage(bitbucket)}
On GitLab | ${gitlab.length} |  ${percentage(gitlab)}
`)
