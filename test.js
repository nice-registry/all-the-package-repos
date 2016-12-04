const test = require('tape')
const repos = require('.')

test('repos', function (t) {
  t.ok(Object.keys(repos).length > 280 * 1000, 'is an object with hella keys')
  t.equal(repos.moby, 'https://github.com/zeke/moby', 'sets URLs as values')
  t.equal(repos.express, 'https://github.com/expressjs/express', 'sets shorthand github URLs to full URL')
  t.end()
})
