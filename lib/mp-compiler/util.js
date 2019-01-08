const path = require('path')
const fs = require('fs')
const resolveSrc = require('../utils/resolve-src')
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
function getCompInfo (context, file, fileExt) {
  const filePath = `/${resolveSrc(context, file)}.${fileExt.template}`
  if (!cache[file]) {
    cache[file] = hash(file)
  }
  return {
    filePath,
    name: cache[file]
  }
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

function getKeyFromObjByVal (obj, val) {
  for (const i in obj) {
    if (path.resolve(obj[i]) === path.resolve(val)) {
      return i
    }
  }
}

function getPageSrc (pageName) {
  return path.parse(pageName).dir ? pageName : `pages/${pageName}/${pageName}`
}

// TODO, 这儿应该按照 main.js 导出的 config 来进行 isApp isPage 识别，暂时不改，下次大版本升级 loader 的时候改
// 计算目标输出的路径等信息
// pageType 默认为 null === component, 目前共 3 种类型: component, app, page
function resolveTarget (dir, entry) {
  const originName = getKeyFromObjByVal(entry, dir)
  const name = originName || getNameByFile(dir)
  const isApp = name === 'app'
  const pageType = isApp ? 'app' : (originName ? 'page' : 'component')
  const isPage = pageType === 'page'

  let src = 'app'
  if (isPage) {
    src = getPageSrc(name)
  }

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
const importCodeCache = Object.create(null)

function cacheSlots (slots, importCode) {
  Object.keys(slots).forEach(k => {
    slotsCache[k] = slots[k]
  })
  importCodeCache[importCode] = importCode
}
function getSlots () {
  const allImportCode = Object.keys(importCodeCache).map(v => importCodeCache[v]).join('\n').replace('<import src="/components/slots" />', '')
  const allSlots = Object.keys(slotsCache).map(v => slotsCache[v].code).join('\n')
  return allImportCode + allSlots
}

// 包大小优化: build 模式不需要美化 mpml
const jsBeautify = require('js-beautify')
const isProduction = process.env.NODE_ENV === 'production'
function htmlBeautify (content) {
  const htmlBeautifyOptions = {
    // wrap_line_length: '80',
    indent_size: 2,
    preserve_newlines: false,
    max_preserve_newlines: 0,
    e4x: true,
    unformatted: ['a', 'span', 'img', 'code', 'pre', 'sub', 'sup', 'em', 'strong', 'b', 'i', 'u', 'strike', 'big', 'small', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  }

  if (isProduction) {
    return content
  }
  return jsBeautify.html(content, htmlBeautifyOptions)
}

function getBabelrc (src) {
  if (src && fs.existsSync(src)) {
    return src
  }
  const curBabelRc = path.resolve('./.babelrc')
  if (fs.existsSync(curBabelRc)) {
    return curBabelRc
  }
  return ''
}

function defaultPart (type) {
  return {
    type,
    content: '\n',
    start: 0,
    attrs: {},
    end: 1,
    map: {
      version: 3,
      sources: [],
      names: [],
      mappings: '',
      sourcesContent: []
    }
  }
}

module.exports = {
  defaultPart,
  cacheFileInfo,
  getFileInfo,
  getCompInfo,
  resolveTarget,
  covertCCVar,
  cacheSlots,
  getSlots,
  htmlBeautify,
  getBabelrc,
  getPageSrc
}
