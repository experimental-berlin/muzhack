'use strict'
module.exports.findAll = (pattern, str) => {
  let matches = []
  let re = new RegExp(pattern)
  while (true) {
    let match = re.exec(str)
    if (match == null) {
      break
    }

    matches.push(match[1])
    str = str.slice(match.index + match[0].length)
  }

  return matches
}
