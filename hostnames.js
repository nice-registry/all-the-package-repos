#!/usr/bin/env node

const urlModule = require('url')
const countValues = require('count-array-values')
const hostnames = []

Object.values(require('.')).forEach((url) => {
  if (!url) {
    return
  }

  try {
    hostnames.push((new urlModule.URL('', url)).host.replace(/^www\./i, ''))
  } catch (err) {}
})

const counts = countValues(hostnames)

module.exports = counts

if (require.main) {
  const pad = require('pad')
  const longestHostname = hostnames.sort((a, b) => b.length - a.length)[0]

  counts.forEach(hostname => {
    console.log(pad(hostname.value, longestHostname.length + 3) + String(hostname.count))
  })
}
