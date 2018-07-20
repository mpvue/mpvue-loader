function genPageWxml (templateName, src) {
  return `<import src="${src}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

module.exports = { genPageWxml }
