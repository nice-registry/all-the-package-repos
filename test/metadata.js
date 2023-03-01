const describe = require('mocha').describe
const it = require('mocha').it
const expect = require('chai').expect

const packages = require('../data/packages.json')
const metadata = require('../data/metadata.json')

const sum = (a, b) => a + b

describe('metadata', () => {
  describe('repos', () => {
    it('should match repos', () => {
      const real = Object
        .keys(packages)
        .length

      const repos = Object
        .values(metadata.repos)
        .reduce(sum, 0)

      expect(repos)
        .to.be.equals(real)
    })

    it('should match unsets', () => {
      const real = Object
        .values(packages)
        .filter(url => url === null)
        .length

      expect(metadata.repos.unsets || 0)
        .to.be.equals(real)
    })

    it('should match urls', () => {
      const real = Object
        .values(packages)
        .filter(Boolean)
        .length

      const repos = Object
        .values(metadata.repos)
        .reduce(sum, 0)

      const others = repos - (metadata.repos.unsets || 0)

      expect(others)
        .to.be.equals(real)
    })
  })

  describe('stats', () => {
    it('should correctly count changes', () => {
      const changes = metadata.stats.inserts +
        metadata.stats.updates +
        metadata.stats.deletes +
        metadata.stats.invalid

      expect(metadata.stats.changes)
        .to.be.equals(changes)
    })
  })
})
