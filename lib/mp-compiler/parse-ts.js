let ts
try {
  ts = require('typescript')
} catch (e) {
  // console.error(e)
}

function parseComponentsDeps (scriptContent) {
  if (ts === null) {
    throw new Error('Please run `npm install -S typescript` to install TypeScript.')
  }
  const sourceFile = ts.createSourceFile('test', scriptContent, ts.ScriptTarget.ESNext, /* setParentNodes */ true)
  return delint(sourceFile)
}

function delint (sourceFile) {
  const compNames = {}
  const importsMap = {}

  delintNode(sourceFile)

  function parseDecorator (node) {
    // 只处理 @Component({components:{aaa}})
    if (node.expression.expression && node.expression.expression.escapedText === 'Component') {
      const compArgs = node.expression.arguments
      if (compArgs && compArgs.length === 1) {
        let vueClassArg = compArgs[0]
        if (vueClassArg.kind === ts.SyntaxKind.AsExpression) { // @Component({ components: ...,} as any)
          vueClassArg = vueClassArg.expression
        }
        if (vueClassArg.properties) {
          vueClassArg.properties.forEach((classProp) => {
            // 处理components属性
            if (classProp.name.escapedText === 'components') {
              classProp.initializer.properties.forEach((comp) => {
                let compName
                switch (comp.kind) {
                  case ts.SyntaxKind.ShorthandPropertyAssignment: // {Comp}
                    compName = comp.name.escapedText
                    // report(comp, '1')
                    break
                  case ts.SyntaxKind.PropertyAssignment: // {a:Comp}
                    compName = comp.initializer.escapedText
                    // report(comp, '2')
                    break
                }
                compNames[compName] = true
              })
            }
          })
        }
      }
    }
  }

  function delintNode (node) {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
        // 只处理 import Comp from 'xxx.vue'
        if (node.importClause && node.importClause.name) {
          importsMap[node.importClause.name.escapedText] = node.moduleSpecifier.text
        }
        // report(node, 'import')
        break
      case ts.SyntaxKind.Decorator:
        parseDecorator(node)
        break
    }

    ts.forEachChild(node, delintNode)
  }

  function report(node, message) { // eslint-disable-line
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
    console.log(`${sourceFile.fileName} (${line + 1},${character + 1}): ${message}`)
  }

  const components = {}
  for (const k in compNames) {
    if (importsMap.hasOwnProperty(k)) {
      components[k] = importsMap[k]
    }
  }
  return {
    importsMap,
    components
  }
}

module.exports = { parseComponentsDeps }
