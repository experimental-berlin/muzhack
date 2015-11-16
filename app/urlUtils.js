'use strict'
module.exports = {
  normalizePath: (path) => {
    if (path[0] !== '/') {
      path = `/${path}`
    }
    while (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1)
    }
    return path
  }
}
