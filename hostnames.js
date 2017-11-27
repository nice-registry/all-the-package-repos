#!/usr/bin/env node

const URL = require('url')
const countValues = require('count-array-values')
const urls = Object.values(require('.'))
const hostnames = urls.map(url => URL.parse(url).hostname.replace(/^www\./i, ''))
const counts = countValues(hostnames)

module.exports = counts

if (!module.parent) {
  const pad = require('pad')
  const longestHostname = hostnames.sort((a, b) => b.length - a.length)[0]

  counts.forEach(hostname => {
    console.log(pad(hostname.value, longestHostname.length+3) + String(hostname.count))
  })
}