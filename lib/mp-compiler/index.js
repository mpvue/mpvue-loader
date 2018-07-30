// for mp
const compiler = require('mpvue-template-compiler')

const babel = require('babel-core')
const path = require('path')
const fs = require('fs')
const deepEqual = require('deep-equal')

const { parseConfig, parseComponentsDeps, parseGlobalComponents, clearGlobalComponents } = require('./parse')
const { parseComponentsDeps: parseComponentsDepsTs } = require('./parse-ts')
const { genPageWxml } = require('./templates')

const {
  cacheFileInfo,
  getFileInfo,
  getCompNameAndSrc,
  resolveTarget,
  covertCCVar,
  cacheSlots,
  getSlots,
  htmlBeautify,
  getBabelrc
} = require('./util')

let slotsHookAdded = false

// 调用 compiler 生成 wxml
function genComponentWxml (compiled, options, emitFile, emitError, emitWarning) {
  options.components['slots'] = { src: '/components/slots', name: 'slots' }
  const { code: wxmlCodeStr, compiled: cp, slots, importCode } = compiler.compileToWxml(compiled, options)
  const { mpErrors, mpTips } = cp
  // 缓存 slots，延迟编译
  cacheSlots(slots, importCode)

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
  return htmlBeautify(wxmlCodeStr)
}

function createAppWxml (emitFile, resourcePath, rootComponent, context) {
  const { src } = getFileInfo(resourcePath) || {}
  const { name: componentName, filePath: wxmlSrc } = getCompNameAndSrc(context, rootComponent)
  const wxmlContent = genPageWxml(componentName, wxmlSrc)
  emitFile(`${src}.wxml`, wxmlContent)
}
// 更新全局组件时，需要重新生成wxml，用这个字段保存所有需要更新的页面及其参数
const cacheCreateWxmlFns = {}

function createWxml ({ emitWarning, emitError, emitFile, resourcePath, context, compiled }) {
  cacheCreateWxmlFns[resourcePath] = arguments
  const { pageType, moduleId, components } = getFileInfo(resourcePath) || {}

  // TODO, 这儿传 options 进去
  // {
  //   components: {
  //     'com-a': { src: '../../components/comA$hash', name: 'comA$hash' }
  //   },
  //   pageType: 'component',
  //   name: 'comA$hash',
  //   moduleId: 'moduleId'
  // }
  const { name, filePath: wxmlSrc } = getCompNameAndSrc(context, resourcePath)
  const options = { components, pageType, name, moduleId }
  const wxmlContent = genComponentWxml(compiled, options, emitFile, emitError, emitWarning)
  emitFile(wxmlSrc, wxmlContent)
}

// 编译出 wxml
function compileWxml (compiled, html) {
  if (!slotsHookAdded) {
    // avoid add hook several times during compilation
    slotsHookAdded = true
    // TODO: support webpack4
    this._compilation.plugin('seal', () => {
      const content = getSlots()
      if (content.trim()) {
        this.emitFile('components/slots.wxml', htmlBeautify(content))
      }
      // reset flag after slots file emited
      slotsHookAdded = false
    })
  }
  return new Promise(resolve => {
    const pollComponentsStatus = () => {
      const { pageType, components } = getFileInfo(this.resourcePath) || {}
      if (!pageType || (components && !components.isCompleted)) {
        setTimeout(pollComponentsStatus, 20)
      } else {
        resolve()
      }
    }
    pollComponentsStatus()
  })
    .then(() => {
      createWxml({
        emitWarning: this.emitWarning,
        emitError: this.emitError,
        emitFile: this.emitFile,
        resourcePath: this.resourcePath,
        context: this.options.context,
        rootComponent: null,
        compiled, html
      })
    })
}

// 针对 .vue 单文件的脚本逻辑的处理
// 处理出当前单文件组件的子组件依赖
function compileMPScript (script, mpOptioins, moduleId) {
  const { resourcePath, options, resolve, context } = this
  const babelrc = getBabelrc(mpOptioins.globalBabelrc)
  let result, metadata
  let scriptContent = script.content
  const babelOptions = { extends: babelrc, plugins: [parseComponentsDeps] }
  if (script.src) { // 处理src
    const scriptpath = path.join(path.dirname(resourcePath), script.src)
    scriptContent = fs.readFileSync(scriptpath).toString()
  }
  if (script.lang === 'ts') { // 处理ts
    metadata = parseComponentsDepsTs(scriptContent)
  } else {
    result = babel.transform(scriptContent, babelOptions)
    metadata = result.metadata
  }

  // metadata: importsMap, components
  const { importsMap, components: originComponents } = metadata

  // 处理子组件的信息
  const components = {}
  const fileInfo = resolveTarget(resourcePath, options.entry)
  if (originComponents) {
    resolveSrc(originComponents, components, resolve, context, options.context).then(() => {
      resolveComponent(resourcePath, fileInfo, importsMap, components, moduleId)
    }).catch(err => {
      console.error(err)
      resolveComponent(resourcePath, fileInfo, importsMap, components, moduleId)
    })
  } else {
    resolveComponent(resourcePath, fileInfo, importsMap, components, moduleId)
  }

  return script
}

// checkMPEntry 针对 entry main.js 的入口处理
// 编译出 app, page 的入口js/wxml/json

let globalComponents
function compileMP (content, mpOptioins) {
  const { resourcePath, emitFile, resolve, context, options } = this

  const fileInfo = resolveTarget(resourcePath, options.entry)
  cacheFileInfo(resourcePath, fileInfo)
  const { isApp, isPage } = fileInfo
  if (isApp) {
    // 解析前将可能存在的全局组件清空
    clearGlobalComponents()
  }

  const babelrc = getBabelrc(mpOptioins.globalBabelrc)
  // app入口进行全局component解析
  const { metadata } = babel.transform(content, { extends: babelrc, plugins: isApp ? [parseConfig, parseGlobalComponents] : [parseConfig] })

  // metadata: config
  const { rootComponent, globalComponents: globalComps } = metadata

  if (isApp) {
    // 保存旧数据，用于对比
    const oldGlobalComponents = globalComponents
    // 开始解析组件路径时把全局组件清空，解析完成后再进行赋值，标志全局组件解析完成
    globalComponents = null

    // 解析全局组件的路径
    const components = {}
    resolveSrc(globalComps, components, resolve, context, options.context).then(() => {
      handleResult(components)
    }).catch(err => {
      console.error(err)
      handleResult(components)
    })
    const handleResult = components => {
      globalComponents = components
      // 热更时，如果全局组件更新，需要重新生成所有的wxml
      if (oldGlobalComponents && !deepEqual(oldGlobalComponents, globalComponents)) {
        // 更新所有页面的组件
        Object.keys(cacheResolveComponents).forEach(k => {
          resolveComponent(...cacheResolveComponents[k])
        })
        // 重新生成所有wxml
        Object.keys(cacheCreateWxmlFns).forEach(k => {
          createWxml(...cacheCreateWxmlFns[k])
        })
      }
    }
  }

  if (isApp || isPage) {
    // 这儿应该异步在所有的模块都清晰后再生成
    // 生成入口 wxml
    if (isPage && rootComponent) {
      resolve(context, rootComponent, (err, rootComponentSrc) => {
        if (err) return
        // 这儿需要搞定 根组件的 路径
        createAppWxml(emitFile, resourcePath, rootComponentSrc, this.options.context)
      })
    }
  }

  return content
}

function resolveSrc (originComponents, components, resolveFn, context, projectRoot) {
  return Promise.all(Object.keys(originComponents).map(k => {
    return new Promise((resolve, reject) => {
      resolveFn(context, originComponents[k], (err, realSrc) => {
        if (err) return reject(err)
        const com = covertCCVar(k)
        const { filePath, name } = getCompNameAndSrc(projectRoot, realSrc)
        components[com] = { src: filePath, name }
        resolve()
      })
    })
  }))
}

const cacheResolveComponents = {}
function resolveComponent (resourcePath, fileInfo, importsMap, localComponents, moduleId) {
  // 需要等待全局组件解析完成
  if (!globalComponents) {
    setTimeout(resolveComponent, 20, ...arguments)
  } else {
    // 保存当前所有参数，在热更时如果全局组件发生变化，需要进行组件更新
    cacheResolveComponents[resourcePath] = arguments
    const components = Object.assign({}, globalComponents, localComponents)
    components.isCompleted = true
    cacheFileInfo(resourcePath, fileInfo, { importsMap, components, moduleId })
  }
}

module.exports = { compileWxml, compileMPScript, compileMP }
