const stream = require('stream')
const nock = require('nock')

module.exports.loadUpdateScript = () => {
  delete require.cache[require.resolve('../scripts/update.js')]
  return require('../scripts/update')
}

module.exports.mockChangesStream = (changes) => {
  nock('https://replicate.npmjs.com')
    .get('/')
    .times(2)
    .reply(200, {
      'db_name': 'registry',
      'doc_count': changes.length,
      'update_seq': changes.length ? changes[changes.length - 1].seq : 0,
      'instance_start_time': '1631412299486989'
    })

  nock('https://replicate.npmjs.com')
    .get('//_changes')
    .query({
      'feed': 'continuous',
      'heartbeat': '900000',
      'include_docs': 'true',
      'limit': changes.length,
      'since': 0
    })
    .reply(200, () => {
      let count = 0
      return new stream.Readable({
        read () {
          this.push(JSON.stringify(changes[count]) + '\n')
          if (++count >= changes.length) this.push(null)
        }
      })
    })
}
