const isUrl = require('is-url')
const to = {
  github: require('github-url-to-object'),
  bitbucket: require('bitbucket-url-to-object')
}

const urlToObject = (parse) => {
  return (url) => {
    const found = parse(url)
    return found && found.https_url
  }
}

const plainUrl = (url) => {
  if (isUrl(url) && url.startsWith('http')) {
    return url
  }
}

const URL_PARSERS = [
  urlToObject(to.github),
  urlToObject(to.bitbucket),
  plainUrl
]

const parseUrl = (repo) => {
  const url = typeof repo === 'string'
    ? repo
    : repo.url

  if (typeof url !== 'string') {
    return
  }

  for (const parse of URL_PARSERS) {
    try {
      const result = parse(url)
      if (result) return result
    } catch (err) {
      continue
    }
  }
}

/**
 * @return {string} - repo url
 */
const extractUrl = (change) => {
  const repo = change.doc && change.doc.repository

  return repo && parseUrl(repo)
}

module.exports = extractUrl
