const expect = require('chai').expect

const { mockChangesStream, loadUpdateScript } = require('../utils')
const changes = require('../mocks/changes.json')

describe('Update process', function () {
  it('should process empty batch', async () => {
    mockChangesStream([])

    const updateScript = loadUpdateScript()
    const meta = await updateScript()

    expect(meta.batch.status).to.equal('init')
    expect(meta.runs.status.init).to.equal(1)
  })

  it('should delete package', async () => {
    mockChangesStream(changes['delete-package'])

    const updateScript = loadUpdateScript()
    const meta = await updateScript()

    expect(meta.repos).to.deep.equal({
      'github': 0,
      'gitlab': 0,
      'bitbucket': 0,
      'others': 0,
      'unset': 0
    })

    expect(meta.stats).to.deep.equal({
      'changes': 3,
      'inserts': 1,
      'updates': 1,
      'deletes': 1,
      'invalid': 0,
      'ignored': 0
    })
  })

  it('should remove repo from existing', async () => {
    mockChangesStream(changes['remove-repo-from-existing'])

    const updateScript = loadUpdateScript()
    const meta = await updateScript()

    expect(meta.repos).to.deep.equal({
      'github': 0,
      'gitlab': 0,
      'bitbucket': 0,
      'others': 0,
      'unset': 1
    })

    expect(meta.stats).to.deep.equal({
      'changes': 3,
      'inserts': 1,
      'updates': 2,
      'deletes': 0,
      'invalid': 1,
      'ignored': 0
    })
  })

  it('should keep repository statistics', async () => {
    mockChangesStream(changes['track-repos-stats'])

    const updateScript = loadUpdateScript()
    const meta = await updateScript()

    expect(meta.repos).to.deep.equal({
      'github': 0,
      'gitlab': 1,
      'bitbucket': 0,
      'others': 0,
      'unset': 0
    })

    expect(meta.stats).to.deep.equal({
      'changes': 3,
      'inserts': 1,
      'updates': 2,
      'deletes': 0,
      'invalid': 1,
      'ignored': 0
    })
  })

  it('should keep repository statistics 2', async () => {
    mockChangesStream(changes['track-repos-stats-2'])

    const updateScript = loadUpdateScript()
    const meta = await updateScript()

    expect(meta.repos).to.deep.equal({
      'github': 0,
      'gitlab': 0,
      'bitbucket': 0,
      'others': 0,
      'unset': 1
    })

    expect(meta.stats).to.deep.equal({
      'changes': 4,
      'inserts': 1,
      'updates': 3,
      'deletes': 0,
      'invalid': 2,
      'ignored': 0
    })
  })
})
