// for mp
const compiler = require('mpvue-template-compiler')
const htmlBeautify = require('js-beautify').html

const path = require('path')
const babel = require('babel-core')
const { parseConfig, parseComponentsDeps } = require('./parse')
const { genScript, genStyle, genPageWxml } = require('./templates')

const { cacheFileInfo, getFileInfo, getCompNameBySrc, resolveTarget, covertCCVar, cacheSlots, getSlots } = require('./util')

const htmlBeautifyOptions = {
  wrap_line_length: '80',
  indent_size: 2,
  preserve_newlines: true,
  max_preserve_newlines: 0,
  e4x: true,
  unformatted: ['a', 'span', 'img', 'code', 'pre', 'sub', 'sup', 'em', 'strong', 'b', 'i', 'u', 'strike', 'big', 'small', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
}

function createSlotsWxml (emitFile, slots) {
  cacheSlots(slots)
  const allSlots = getSlots()
  const content = Object.keys(allSlots).map(v => allSlots[v].code).join('\n')
  if (content.trim()) {
    emitFile('components/slots.wxml', htmlBeautify(content, htmlBeautifyOptions))
  }
}

// 调用 compiler 生成 wxml
function genComponentWxml (compiled, options, emitFile, emitError, emitWarning) {
  options.components['slots'] = { src: 'slots', name: 'slots' }
  const { code: wxmlCodeStr, compiled: cp, slots } = compiler.compileToWxml(compiled, options)
  const { mpErrors, mpTips } = cp

  // 缓存 slots，延迟编译
  createSlotsWxml(emitFile, slots)

  if (mpErrors && mpErrors.length) {
    emitError(
      `\n  Error compiling template:\n` +
      mpErrors.map(e => `  - ${e}`).join('\n') + '\n'
    )
  }
  if (mpTips && mpTips.length) {
    emitWarning(
      mpTips.map(e => `  - ${e}`).join('\n') + '\n'
    )
  }
  return htmlBeautify(wxmlCodeStr, htmlBeautifyOptions)
}

function createWxml (emitWarning, emitError, emitFile, resourcePath, rootComponent, compiled, html) {
  const { pageType, moduleId, components, src } = getFileInfo(resourcePath) || {}

  // 这儿一个黑魔法，和 webpack 约定的规范写法有点偏差！
  if (!pageType || (components && !components.isCompleted)) {
    return setTimeout(createWxml, 20, ...arguments)
  }

  let wxmlContent = ''
  let wxmlSrc = ''

  if (rootComponent) {
    const componentName = getCompNameBySrc(rootComponent)
    wxmlContent = genPageWxml(componentName)
    wxmlSrc = src
  } else {
    // TODO, 这儿传 options 进去
    // {
    //   components: {
    //     'com-a': { src: '../../components/comA$hash', name: 'comA$hash' }
    //   },
    //   pageType: 'component',
    //   name: 'comA$hash',
    //   moduleId: 'moduleId'
    // }
    const name = getCompNameBySrc(resourcePath)
    const options = { components, pageType, name, moduleId }
    wxmlContent = genComponentWxml(compiled, options, emitFile, emitError, emitWarning)
    wxmlSrc = `components/${name}`
  }

  emitFile(`${wxmlSrc}.wxml`, wxmlContent)
}

// 编译出 wxml
function compileWxml (compiled, html) {
  return createWxml(this.emitWarning, this.emitError, this.emitFile, this.resourcePath, null, compiled, html)
}

// 针对 .vue 单文件的脚本逻辑的处理
// 处理出当前单文件组件的子组件依赖
function compileMPScript (script, optioins, moduleId) {
  const babelrc = optioins.globalBabelrc ? optioins.globalBabelrc : path.resolve('./.babelrc')
  const { metadata } = babel.transform(script.content, { extends: babelrc, plugins: [parseComponentsDeps] })

  // metadata: importsMap, components
  const { importsMap, components: originComponents } = metadata

  // 处理子组件的信息
  const components = {}
  if (originComponents) {
    const allP = Object.keys(originComponents).map(k => {
      return new Promise((resolve, reject) => {
        this.resolve(this.context, originComponents[k], (err, realSrc) => {
          if (err) return reject(err)
          const com = covertCCVar(k)
          const comName = getCompNameBySrc(realSrc)
          components[com] = { src: comName, name: comName }
          resolve()
        })
      })
    })
    Promise.all(allP)
      .then(res => {
        components.isCompleted = true
      })
      .catch(err => {
        console.error(err)
        components.isCompleted = true
      })
  } else {
    components.isCompleted = true
  }

  const fileInfo = resolveTarget(this.resourcePath, optioins.mpInfo)
  cacheFileInfo(this.resourcePath, fileInfo, { importsMap, components, moduleId })

  return script
}

// checkMPEntry 针对 entry main.js 的入口处理
// 编译出 app, page 的入口js/wxml/json

const startPageReg = /^\^/

function compileMP (content, optioins) {
  const { resourcePath, emitError, emitFile, emitWarning, resolve, context } = this

  const babelrc = optioins.globalBabelrc ? optioins.globalBabelrc : path.resolve('./.babelrc')
  const { metadata } = babel.transform(content, { extends: babelrc, plugins: [parseConfig] })

  // metadata: config
  const { config, rootComponent } = metadata

  const fileInfo = resolveTarget(resourcePath, optioins.mpInfo)
  cacheFileInfo(resourcePath, fileInfo)
  const { src, name, isApp, isPage } = fileInfo

  if (isApp || isPage) {
    // 生成入口 json
    if (config) {
      const configObj = config.value

      // 只有 app 才处理 pages
      if (isApp) {
        const pages = (configObj.pages || []).concat(optioins.pages)

        // ^ 开头的放在第一个
        const startPageIndex = pages.findIndex(v => startPageReg.test(v))
        if (startPageIndex !== -1) {
          const startPage = pages[startPageIndex].slice(1)
          pages.splice(startPageIndex, 1)
          pages.unshift(startPage)
        }
        configObj.pages = [...new Set(pages)]
      }
      emitFile(`${src}.json`, JSON.stringify(configObj, null, '  '))
    }

    // 生成入口 js
    emitFile(`${src}.js`, genScript(name, isPage))

    // 生成入口 wxss
    emitFile(`${src}.wxss`, genStyle(name, isPage))

    // 这儿应该异步在所有的模块都清晰后再生成
    // 生成入口 wxml
    if (isPage && rootComponent) {
      resolve(context, rootComponent, (err, rootComponentSrc) => {
        if (err) return
        // 这儿需要搞定 根组件的 路径
        createWxml(emitWarning, emitError, emitFile, resourcePath, rootComponentSrc)
      })
    }
  }

  return content
}

module.exports = { compileWxml, compileMPScript, compileMP }
