var loaderUtils = require('loader-utils')
var normalize = require('../utils/normalize')
var compiler = require('mpvue-template-compiler')
var beautify = require('js-beautify').js_beautify
var transpile = require('vue-template-es2015-compiler')
var hotReloadAPIPath = normalize.dep('vue-hot-reload-api')
var transformRequire = require('./modules/transform-require')

// for mp
var compileMPML = require('../mp-compiler').compileMPML

module.exports = function (html) {
  this.async()
  this.cacheable()
  var isServer = this.target === 'node'
  var isProduction = this.minimize || process.env.NODE_ENV === 'production'
  var vueOptions = this.options.__vueOptions__ || {}
  var options = loaderUtils.getOptions(this) || {}

  var defaultModules = [transformRequire(options.transformToRequire, {
    outputPath: this.options.output.path,
    resourcePath: this.resourcePath,
    context: this.options.context
  })]

  var userModules = vueOptions.compilerModules || options.compilerModules
  // for HappyPack cross-process use cases
  if (typeof userModules === 'string') {
    userModules = require(userModules)
  }

  var compilerOptions = {
    preserveWhitespace: options.preserveWhitespace,
    modules: defaultModules.concat(userModules || []),
    scopeId: options.hasScoped ? options.id : null,
    comments: options.hasComment
  }

  var compile = isServer && compiler.ssrCompile && vueOptions.optimizeSSR !== false
    ? compiler.ssrCompile
    : compiler.compile

  var compiled = compile(html, compilerOptions)
  var code

  // for mp => *.mpml
  compileMPML.call(this, compiled, html, options)
    .then(() => {
      // tips
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(tip => {
          this.emitWarning(tip)
        })
      }

      if (compiled.errors && compiled.errors.length) {
        this.emitError(
          `\n  Error compiling template:\n${pad(html)}\n` +
          compiled.errors.map(e => `  - ${e}`).join('\n') + '\n'
        )
        code = vueOptions.esModule
          ? `var esExports = {render:function(){},staticRenderFns: []}\nexport default esExports`
          : 'module.exports={render:function(){},staticRenderFns:[]}'
      } else {
        var bubleOptions = options.buble
        code = transpile(
          'var render = ' + toFunction(compiled.render) + '\n' +
          'var staticRenderFns = [' + compiled.staticRenderFns.map(toFunction).join(',') + ']',
          bubleOptions
        ) + '\n'
        // mark with stripped (this enables Vue to use correct runtime proxy detection)
        if (!isProduction && (
          !bubleOptions ||
          !bubleOptions.transforms ||
          bubleOptions.transforms.stripWith !== false
        )) {
          code += `render._withStripped = true\n`
        }
        var exports = `{ render: render, staticRenderFns: staticRenderFns }`
        code += vueOptions.esModule
          ? `var esExports = ${exports}\nexport default esExports`
          : `module.exports = ${exports}`
      }
      // hot-reload
      if (!isServer && !isProduction) {
        var exportsName = vueOptions.esModule ? 'esExports' : 'module.exports'
        code +=
          '\nif (module.hot) {\n' +
          '  module.hot.accept()\n' +
          '  if (module.hot.data) {\n' +
          '     require("' + hotReloadAPIPath + '").rerender("' + options.id + '", ' + exportsName + ')\n' +
          '  }\n' +
          '}'
      }

      this.callback(null, code)
    })
    .catch(() => {
      this.callback(null, code)
    })
}

function toFunction (code) {
  return 'function () {' + beautify(code, {
    indent_size: 2 // eslint-disable-line camelcase
  }) + '}'
}

function pad (html) {
  return html.split(/\r?\n/).map(line => `  ${line}`).join('\n')
}
