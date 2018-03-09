const path = require('path')

const pagesNameMap = Object.create(null)

function cacheFileInfo (resourcePath, ...arg) {
  pagesNameMap[resourcePath] = Object.assign({}, pagesNameMap[resourcePath], ...arg)
}

function getFileInfo (resourcePath) {
  return pagesNameMap[resourcePath] || {}
}

// 单文件的名字+hash
// TODO: 调试时取个全名
var hash = require('hash-sum')
const cache = Object.create(null)
function getCompNameBySrc (file) {
  return cache[file] || (cache[file] = `${getNameByFile(file)}$${hash(file)}`)
}

// 根据路径获得组件名
function getNameByFile (dir) {
  // const arr = dir.match(/[pages?/components?]\/(.*?)(\/)/)
  const arr = dir.match(/pages\/(.*?)\//)
  if (arr && arr[1]) {
    return arr[1]
  }
  return path.parse(dir).name
}

// 计算目标输出的路径等信息
// pageType 默认为 null === component, 目前共 3 种类型: component, app, page
function resolveTarget (dir, mpInfo = {}) {
  const originName = mpInfo[dir]
  const name = originName || getNameByFile(dir)
  const isApp = name === 'app'
  const pageType = isApp ? 'app' : (originName ? 'page' : 'component')
  const isPage = pageType === 'page'

  // components 目录暂时无用
  const src = isApp ? 'app' : isPage ? `pages/${name}/${name}` : `components/${name}`

  return { pageType, src, name, isApp, isPage }
}

// 简单的转换驼峰大写为中横线
const hyphenateRE = /([^-])([A-Z])/g
function covertCCVar (str) {
  return str
    .replace(hyphenateRE, '$1-$2')
    .replace(hyphenateRE, '$1-$2')
    .toLowerCase()
}

// 缓存所有的 slots 节点，生成一个文件
const slotsCache = Object.create(null)
function cacheSlots (slots) {
  Object.keys(slots).forEach(k => {
    slotsCache[k] = slots[k]
  })
}
function getSlots (slotName) {
  return slotName ? slotsCache[slotName] : slotsCache
}

module.exports = { cacheFileInfo, getFileInfo, getCompNameBySrc, resolveTarget, covertCCVar, cacheSlots, getSlots }
