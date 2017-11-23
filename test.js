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

  it('is always a URL', () => {
    const urls = Object.values(repos)
    urls.forEach(url => {
      expect(isUrl(url), `${url}`).to.eq(true)
    })
  })
})
