const fs = require('fs')
const path = require('path')
const expect = require('chai').expect

const { loadUpdateScript, mockChangesStream } = require('../utils')
const changes = require('../mocks/changes.json')

process.env.CACHE_DIR = './.test_output/cache'

describe('Caching', function () {
  before(() => {
    process.env.CACHE_READ = 0
    process.env.CACHE_WRITE = 1
  })

  beforeEach(() => {
    fs.rmSync(path.resolve(process.env.CACHE_DIR), { recursive: true, force: true })
    fs.mkdirSync(path.resolve(process.env.CACHE_DIR), { recursive: true })
  })

  after(() => {
    process.env.CACHE_DIR = undefined
    process.env.CACHE_READ = undefined
    process.env.CACHE_WRITE = undefined
  })

  it('should cache all changes', async () => {
    mockChangesStream(changes['cache-all-changes'])

    const updateScript = loadUpdateScript()
    const meta = await updateScript()
    const cached = JSON.parse(fs.readFileSync('./.test_output/cache/0.json').toString())

    expect(meta.batch.status).to.equal('init')
    expect(cached).to.deep.equal([
      {
        'seq': 1,
        'id': 'package1',
        'doc': {
          'repository': {
            'type': 'git',
            'url': 'git+https://github.com/test/package1.git'
          }
        }
      },
      {
        'seq': 2,
        'id': 'package1',
        'doc': {
          'repository': 'https://gitlab.com/test/package1-updated.git'
        }
      },
      {
        'seq': 3,
        'id': 'package1',
        'doc': {}
      },
      {
        'seq': 4,
        'id': 'package1',
        'deleted': true
      }
    ])
  })
})
