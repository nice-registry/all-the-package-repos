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
      repos: {
        github: 1,
        gitlab: 2,
        bitbucket: 3,
        unsets: 4,
        others: 5
      }
    }

    metadata.packages = Object
      .values(metadata.repos)
      .reduce((a, b) => a + b, 0)

    const table = tpl.build(metadata)

    expect(table)
      .to.be.a('string')
      .to.match(tpl.regex)
      .to.match(/With repository \| 11 \| 73.33%/)
      .to.match(/Null repository \| 4 \| 26.67%/)
      .to.match(/\*\*Total\*\* \| 15 \| 100.00%/)
      .to.match(/GitHub \| 1 \| 6.67%/)
      .to.match(/GitLab \| 2 \| 13.33%/)
      .to.match(/Bitbucket \| 3 \| 20.00%/)
      .to.match(/Others \| 5 \| 33.33%/)
      .to.match(/\*\*Total\*\* \| 11 \| 73.33%/)
  })
})
