const relative = require('relative')
const upath = require('upath')

module.exports = function (...arv) {
  return upath.normalize(relative(...arv))
}
