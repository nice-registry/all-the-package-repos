const describe = require('mocha').describe
const it = require('mocha').it
const expect = require('chai').expect
const isUrl = require('is-url')
const repos = require('.')

describe('repos', () => {
  it('is an object with lots of values', () => {
    expect(Object.keys(repos).length).to.be.above(455 * 1000)
  })

  it('sets URLs as values', () => {
    expect(repos.moby).to.equal('https://github.com/zeke/moby')
  })

  it('sets shorthand GitHub URLS to full URL', () => {
    expect(repos.express).to.equal('https://github.com/expressjs/express')
  })

  it('is always a URL', function () {
    this.timeout(10 * 1000)
    const urls = Object.values(repos)
    urls.forEach(url => {
      expect(isUrl(url), `${url}`).to.eq(true)
    })
  })

  it('includes scoped package names', () => {
    expect(repos['@angular/core']).to.equal('https://github.com/angular/angular')

    const scopedNames = Object.keys(repos).filter(name => name.startsWith('@'))
    expect(scopedNames.length).to.be.above(32 * 1000)
  })
})

describe('stats', () => {
  const fs = require('fs')
  const path = require('path')
  const tpl = require('./lib/stats-tpl')

  it('sould match the readme table', () => {
    const readme = fs.readFileSync(path.join(__dirname, '/readme.md'))
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
