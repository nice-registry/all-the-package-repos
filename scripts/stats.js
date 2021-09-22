const fs = require('fs')
const path = require('path')

const metadata = require('../data/metadata.json')
const tpl = require('../lib/stats-tpl')

const output = tpl.build(metadata)

const readmeFile = path.join(__dirname, '../readme.md')
const readme = fs
  .readFileSync(readmeFile, 'utf8')
  .replace(tpl.regex, output)

fs.writeFileSync(readmeFile, readme)
