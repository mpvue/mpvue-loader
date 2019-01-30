function genWXML (templateName, src) {
  return `<import src="${src}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

function genSWANML (templateName, src) {
  return `<import src="${src}" /><template is="${templateName}" data="{{{ ...$root['0'], $root }}}"/>`
}

function genTTML (templateName, src) {
  return `<import src="${src}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

function genMYML (templateName, src) {
  return `<import src="${src}" /><template is="${templateName}" data="{{ ...$root['0'], $root }}"/>`
}

function genPageML (templateName, src, fileExt = {}) {
  let code
  switch (fileExt.platform) {
    case 'swan':
      code = genSWANML(templateName, src)
      break
    case 'wx':
      code = genWXML(templateName, src)
      break
    case 'tt':
      code = genTTML(templateName, src)
      break
    case 'my':
      code = genMYML(templateName, src)
      break
    default:
      code = genWXML(templateName, src)
  }
  return code
}

module.exports = { genPageML }
