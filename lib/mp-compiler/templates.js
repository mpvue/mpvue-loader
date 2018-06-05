const { getPathPrefix } = require('./util')

function genScript (name, isPage, src) {
  const prefix = isPage ? getPathPrefix(src) : './'

  return `
require('${prefix}manifest.page')
require('${prefix}vendor.page')
require('${prefix}${name}.page')
`
}

function genStyle (name, isPage, src) {
  const prefix = isPage ? getPathPrefix(src) : './'
  return `@import "/${name}.page.wxss";`
}

function genPageWxml (templateName, src) {
  return `<import src="/${src}/components/${templateName}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

module.exports = { genScript, genStyle, genPageWxml }
