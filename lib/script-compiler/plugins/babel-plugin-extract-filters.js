const babel = require('babel-core')
const types = require('babel-types');

module.exports = () => ({
  visitor: {
    Program: {
      enter(path) {
        path.get('body').forEach((path) => {
          if (!types.isImportDeclaration(path.node) && !types.isExportDefaultDeclaration(path.node)) {
            path.remove();
          }
        });
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
    ImportDeclaration(path) {
      //处理import
      path.remove();
    },
    ExportDefaultDeclaration: {
      enter(path, options) {
        //判断export内部是否有filter，没有则删除所有节点
        path.traverse({
          ObjectProperty(subpath) {
            if (subpath.parentPath.parentPath.type !== 'ExportDefaultDeclaration') {
              return;
            }
            if (subpath.node.key.name !== 'filters') {
              subpath.remove();
            }
          },
          ObjectMethod(subpath) {
            if (subpath.parentPath.parentPath.type !== 'ExportDefaultDeclaration') {
              return;
            }
            subpath.remove();
          }
        });
      },
      exit(path) {
        if (path.get('declaration').node.properties.length === 0) {
          path.remove();
        } else {
          path.replaceWith(
            types.assignmentExpression('=', types.Identifier("module.exports"), path.get('declaration').node.properties[0].value)
          );
        }
      }
    }
  }
});

