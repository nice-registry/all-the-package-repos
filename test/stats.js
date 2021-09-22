const describe = require('mocha').describe
const it = require('mocha').it
const expect = require('chai').expect

describe('stats', () => {
  const fs = require('fs')
  const path = require('path')
  const tpl = require('../lib/stats-tpl')

  it('sould match the readme table', () => {
    const readme = fs.readFileSync(path.join(__dirname, '../readme.md'))
    expect(readme).to.match(tpl.regex)
  })

  it('should build the correct table', () => {
    const metadata = {
      packages: 12,
      repos: {
        github: 3,
        gitlab: 4,
        bitbucket: 6,
        others: 9
      }
    }
    const table = tpl.build(metadata)
    expect(table)
      .to.be.a('string')
      .to.match(tpl.regex)
      .to.match(/With repository in package.json \| 12 \| 100%/)
      .to.match(/GitHub \| 3 \| 25\.00%/)
      .to.match(/GitLab \| 4 \| 33\.33%/)
      .to.match(/Bitbucket \| 6 \| 50\.00%/)
      .to.match(/Others \| 9 \| 75\.00%/)
  })
})
