// vue compiler module for transforming `<tag>:<attribute>` to `require`

var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')

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
      // 资源路径
      var assetPath = path.resolve(path.dirname(fileOptions.resourcePath), value)
      // 重写路径，为了避免重名，在webpack输出目录下新建copy-asset目录，资源保存到这里
      var assetOutputPath = path.join('copy-asset', path.relative(process.cwd(), assetPath).replace(/^src/, ''))
      attrsMap[name] = `/${assetOutputPath.split(path.sep).join('/')}`
      copyAsset(assetPath, path.resolve(fileOptions.outputPath, assetOutputPath))
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
