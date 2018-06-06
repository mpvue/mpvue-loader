const { getPathPrefix } = require('./util')

function genScript (name, isPage, src) {
  const prefix = isPage ? getPathPrefix(src) : './'

  return `
require('${prefix}manifest/js/main.js')
require('${prefix}vendor/js/main.js')
require('${prefix}${name}/js/main.js')
`
}

function genStyle (name, isPage, src) {
  const prefix = isPage ? getPathPrefix(src) : './'
  return `@import "/${name}/css/main.wxss";`
}

function genPageWxml (templateName, src) {
  return `<import src="/${src}/components/${templateName}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

module.exports = { genScript, genStyle, genPageWxml }
