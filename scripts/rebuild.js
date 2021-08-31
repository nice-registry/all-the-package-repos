const fs = require('fs')
const path = require('path')

console.log('Start full rebuild')

// clear the metadata and packages in order to completely rebuild everything
fs.writeFileSync(path.join(__dirname, '../data/packages.json'), '{}')
fs.writeFileSync(path.join(__dirname, '../data/metadata.json'), '{}')

// must be imported after we cleared the files
const reader = require('./lib/reader')

reader().then((metadata) => {
  console.log(metadata)
  process.exit(0)
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
