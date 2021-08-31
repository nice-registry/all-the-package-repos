const fs = require('fs')
const path = require('path')

const repos = Object.values(require('..'))
const withRepo = repos.filter(repo => repo).length
const onGitHub = repos.filter(repo => repo && repo.match('://github.com')).length
const onBitBucket = repos.filter(repo => repo && repo.match('://bitbucket.org')).length
const onGitLab = repos.filter(repo => repo && repo.match('://gitlab.com')).length

const output = `<!-- stats -->
Packages | Count | Percentage
-------- | ----- | ----------
With repository in package.json | ${withRepo} | ${(withRepo / repos.length * 100).toFixed(2)}%
On GitHub | ${onGitHub} |  ${(onGitHub / withRepo * 100).toFixed(2)}%
On BitBucket | ${onBitBucket} |  ${(onBitBucket / withRepo * 100).toFixed(2)}%
On GitLab | ${onGitLab} |  ${(onGitLab / withRepo * 100).toFixed(2)}%
<!-- /stats -->`

const readmeFile = path.join(__dirname, '../README.md')
const readme = fs.readFileSync(readmeFile, 'utf8')

fs.writeFileSync(readmeFile, readme.replace(/<!-- stats -->[\s\S]+<!-- \/stats -->/gm, output))
