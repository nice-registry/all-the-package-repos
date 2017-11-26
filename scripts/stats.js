const fs = require('fs')
const path = require('path')
const allNames = require('all-the-package-names').length
const repos = Object.values(require('..'))
const onGitHub = repos.filter(repo => repo.match('://github.com')).length
const onBitBucket = repos.filter(repo => repo.match('://bitbucket.org')).length
const onGitLab = repos.filter(repo => repo.match('://gitlab.com')).length

const output = `<!-- stats -->
Packages | Count | Percentage of Total Packages
-------- | ----- | ----------------------------
Total in npm registry | ${allNames} | 100%
With repository in package.json | ${repos.length} |  ${(repos.length / allNames * 100).toFixed(2)}%
On GitHub | ${onGitHub} |  ${(onGitHub / allNames * 100).toFixed(2)}%
On BitBucket | ${onBitBucket} |  ${(onBitBucket / allNames * 100).toFixed(2)}%
On GitLab | ${onGitLab} |  ${(onGitLab / allNames * 100).toFixed(2)}%
<!-- /stats -->`

const readmeFile = path.join(__dirname, '../readme.md')
const readme = fs.readFileSync(readmeFile, 'utf8')

fs.writeFileSync(readmeFile, readme.replace(/<!-- stats -->[\s\S]+<!-- \/stats -->/gm, output))