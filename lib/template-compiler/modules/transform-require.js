// vue compiler module for transforming `<tag>:<attribute>` to `require`

var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var relative = require('../../utils/relative')

var defaultOptions = {
  img: 'src',
  image: 'xlink:href'
}

module.exports = (userOptions, fileOptions) => {
  var options = userOptions
    ? Object.assign({}, defaultOptions, userOptions)
    : defaultOptions

  return {
    postTransformNode: node => {
      transform(node, options, fileOptions)
    }
  }
}

function transform (node, options, fileOptions) {
  for (var tag in options) {
    if (node.tag === tag && node.attrs) {
      var attributes = options[tag]
      if (typeof attributes === 'string') {
        rewrite(node.attrsMap, attributes, fileOptions)
      } else if (Array.isArray(attributes)) {
        attributes.forEach(item => rewrite(node.attrsMap, item, fileOptions))
      }
    }
  }
}

function rewrite (attrsMap, name, fileOptions) {
  var value = attrsMap[name]
  if (value) {
    var firstChar = value.charAt(0)
    if (firstChar === '.') {
      var { resourcePath, outputPath, context } = fileOptions
      var assetPath = path.resolve(resourcePath, '..', value)
      // 资源路径, 为了分包，去掉了 src 目录
      var toPath = relative(context, assetPath).replace(/^\/src\//, '')
      attrsMap[name] = path.join(outputPath, toPath)
      copyAsset(assetPath, attrsMap[name])
    }
  }
}

function copyAsset (from, to) {
  var readStream = fs.createReadStream(from)
  mkdirp(path.dirname(to), err => {
    if (err) console.error(err)
    var writeStream = fs.createWriteStream(to)
    readStream.pipe(writeStream)
  })
}
