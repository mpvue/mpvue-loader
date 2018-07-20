const relative = require('relative')
const upath = require('upath')

module.exports = function (...arv) {
  console.log(upath.normalize(relative(...arv)))
  return upath.normalize(relative(...arv))
}
