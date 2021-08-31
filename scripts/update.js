const reader = require('./lib/reader')

reader().then((metadata) => {
  console.log(metadata)
  process.exit(0)
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
