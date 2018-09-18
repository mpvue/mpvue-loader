const babel = require('babel-core')
const extractFiltersBabelPlugins = require('./plugins/babel-plugin-extract-filters');
const combineFiltersBabelPlugins = require('./plugins/babel-plugin-combine-filters');

function extractScriptFilters(scriptContent, babelOptions) {
  babelOptions.plugins = []
  babelOptions.plugins.push(extractFiltersBabelPlugins)
  babelOptions.comments = false
  result = babel.transform(scriptContent, babelOptions)
  result.code = result.code.trim()
  if (!!result.code) {
    //遍历解析处的filter，复制filter包含哪些函数
    let filtersFuncArray = [];
    babel.traverse(result.ast, {
      Program: function (path) {
        path.stop();
        const filters = path.get('body.0.expression.right.properties');
        if (filters.length && filters.length > 0) {
          filters.forEach((filter) => {
            filtersFuncArray.push(filter.get('key').node.name)
          });
        }
      }
    });
    result.filtersFuncArray = filtersFuncArray
    return result
  } else {
    return null
  }
}

function combineScriptAndMixinsFilters(scriptFilter, mixinsFiltersArray, babelOptions) {
  if (scriptFilter === null && (mixinsFiltersArray === null || mixinsFiltersArray.length === 0)) {
    return null
  }
  if (scriptFilter === null && mixinsFiltersArray.length > 0) {
    scriptFilter = {
      code: 'module.exports={\n_empty:null\n};'
    }
  }
  //包含脚本内的filters
  babelOptions.plugins = []
  babelOptions.plugins.push([combineFiltersBabelPlugins, {mixinsFiltersArray: mixinsFiltersArray}])
  babelOptions.comments = false
  result = babel.transform(scriptFilter.code || "", babelOptions)
  result.code = result.code.trim()
  if (!!result.code) {
    return result
  } else {
    return null
  }
}

module.exports = {extractScriptFilters, combineScriptAndMixinsFilters}
