const babel = require('babel-core')
const t = require('babel-types');

module.exports = () => ({
  visitor: {
    Program: {
      enter(path, options) {
        const {mixinsFiltersArray} = options.opts
        if (mixinsFiltersArray && mixinsFiltersArray.length > 0) {
          mixinsFiltersArray.forEach((filters) => {
            if (path.get('body.0')) {
              let insert = t.variableDeclaration('var', [t.variableDeclarator(t.identifier(filters.name), t.callExpression(t.identifier('require'), [t.stringLiteral(filters.realtivePath)]))]);
              path.get('body.0').insertBefore(insert);
            }
          })
        }
      },
      exit(path) {
        //清理use strict
        var list = path.node.directives;
        for (var i = list.length - 1, it; i >= 0; i--) {
          it = list[i];
          if (it.value.value === 'use strict') {
            list.splice(i, 1);
          }
        }
      }
    },
    AssignmentExpression(path, options) {
      if (path.get('left').isMemberExpression()
        && path.get('left.object').node.name === 'module'
        && path.get('left.property').node.name === 'exports') {
        //暂停搜索
        path.stop()
        const {mixinsFiltersArray} = options.opts
        if (mixinsFiltersArray && mixinsFiltersArray.length > 0) {
          const currentFunArray = path.get('right.properties')
          const currentFunNameArray = []
          let lastChild
          currentFunArray.forEach((func, index) => {
            currentFunNameArray.push(func.get('key.name').node)
            if (index === currentFunArray.length - 1) {
              lastChild = func
            }
          })
          mixinsFiltersArray.forEach((filters) => {
            const {extractFilter} = filters;
            extractFilter && extractFilter.filtersFuncArray.forEach((func) => {
              if (currentFunNameArray.indexOf(func) <= 0 && lastChild) {
                let insert = t.objectProperty(t.identifier(func), t.identifier(filters.name + '.' + func))
                lastChild.insertAfter(insert)
              }
            })
          })
        }
      }
    }
  }
});
