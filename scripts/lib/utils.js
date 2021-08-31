/**
 * @param {object} object
 * @param {string|number} spaces [optional] default 2 spaces
 *
 * @return {string}
 */
module.exports.toJson = (object, spaces = 2) => {
  return JSON.stringify(object, null, spaces)
}

/**
 * @param {object} object
 * @return {object}
 */
module.exports.sort = (object) => {
  const sorted = {}
  const keys = Object.keys(object).sort()

  for (const key of keys) {
    sorted[key] = object[key]
  }

  return sorted
}
