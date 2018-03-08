function genScript (name, isPage) {
  const prefix = isPage ? '../..' : '.'

  return `
  import '${prefix}/static/js/manifest'
  import '${prefix}/static/js/vendor'
  import '${prefix}/static/js/${name}'
  `
}

function genStyle (name, isPage) {
  const prefix = isPage ? '../..' : '.'
  return `@import "${prefix}/static/css/${name}.wxss";`
}

function genPageWxml (templateName) {
  return `<import src="../../components/${templateName}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

module.exports = { genScript, genStyle, genPageWxml }
