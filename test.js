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

  it('is always a URL or null', function () {
    this.timeout(30 * 1000)
    const urls = Object.values(repos)

    expect(urls.some(url => isUrl(url)), 'should contain packages with repos').to.equal(true)
    expect(urls.some(url => url === null), 'should contain packages without repos').to.equal(true)
  })

  it('includes scoped package names', () => {
    expect(repos['@angular/core']).to.equal('https://github.com/angular/angular')

    const scopedNames = Object.keys(repos).filter(name => name.startsWith('@'))
    expect(scopedNames.length).to.be.above(32 * 1000)
  })
})
