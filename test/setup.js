process.env.NODE_ENV = 'test'
process.env.DATA_DIR = './.test_output/data'

const fs = require('fs')
const path = require('path')
const nock = require('nock')

before(() => {
  nock.disableNetConnect()
})

beforeEach(() => {
  fs.rmSync(path.resolve(process.env.DATA_DIR), { recursive: true, force: true })
  fs.mkdirSync(path.resolve(process.env.DATA_DIR), { recursive: true })
})

afterEach(() => {
  nock.cleanAll()
})
