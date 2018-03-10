const { getPathPrefix } = require('./util')

function genScript (name, isPage, src) {
  const prefix = isPage ? getPathPrefix(src) : './'

  return `
  import '${prefix}static/js/manifest'
  import '${prefix}static/js/vendor'
  import '${prefix}static/js/${name}'
  `
}

function genStyle (name, isPage, src) {
  const prefix = isPage ? getPathPrefix(src) : './'
  return `@import "${prefix}static/css/${name}.wxss";`
}

function genPageWxml (templateName, src) {
  return `<import src="${getPathPrefix(src)}components/${templateName}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

module.exports = { genScript, genStyle, genPageWxml }
