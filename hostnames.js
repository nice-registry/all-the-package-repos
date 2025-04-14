#!/usr/bin/env node

const URL = require('url')
const countValues = require('count-array-values')
const urls = Object.values(require('.'))
// eslint-disable-next-line n/no-deprecated-api
const hostnames = urls.filter(Boolean).map(url => URL.parse(url).hostname.replace(/^www\./i, ''))
const counts = countValues(hostnames)

module.exports = counts

if (!module.parent) {
  const longestHostname = hostnames.sort((a, b) => b.length - a.length)[0]

  counts.forEach(hostname => {
    console.log(String(hostname.value).padEnd(longestHostname.length + 3) + String(hostname.count))
  })
}
