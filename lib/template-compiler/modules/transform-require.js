// vue compiler module for transforming `<tag>:<attribute>` to `require`

var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')

var defaultOptions = {
  img: 'src',
  image: 'xlink:href'
}

module.exports = (userOptions, fileOptions, emitError) => {
  var options = userOptions
    ? Object.assign({}, defaultOptions, userOptions)
    : defaultOptions

  return {
    postTransformNode: node => {
      transform(node, options, fileOptions, emitError)
    }
  }
}

function transform (node, options, fileOptions, emitError) {
  for (var tag in options) {
    if (node.tag === tag && node.attrs) {
      var attributes = options[tag]
      if (typeof attributes === 'string') {
        rewrite(node.attrsMap, attributes, fileOptions, emitError)
      } else if (Array.isArray(attributes)) {
        attributes.forEach(item => rewrite(node.attrsMap, item, fileOptions, emitError))
      }
    }
  }
}

function rewrite (attrsMap, name, fileOptions, emitError) {
  var value = attrsMap[name]
  if (value) {
    var firstChar = value.charAt(0)
    if (firstChar === '.' || firstChar === '~') {
      // 资源路径
      var assetPath = firstChar === '.'
        ? path.resolve(path.dirname(fileOptions.resourcePath), value)
        : path.resolve(process.cwd(), 'node_modules', value.slice(1))
      // 重写路径，为了避免重名，在webpack输出目录下新建copy-asset目录，资源保存到这里
      var assetOutputPath = path.join('copy-asset', path.relative(process.cwd(), assetPath).replace(/^src/, ''))
      attrsMap[name] = `/${assetOutputPath.split(path.sep).join('/')}`
      copyAsset(assetPath, path.resolve(fileOptions.outputPath, assetOutputPath), emitError)
    }
  }
}

function copyAsset (from, to, emitError) {
  var readStream = fs.createReadStream(from)
  readStream.on('error', emitError)
  mkdirp(path.dirname(to), err => {
    if (err) emitError(err)
    var writeStream = fs.createWriteStream(to)
    readStream.pipe(writeStream)
  })
}
