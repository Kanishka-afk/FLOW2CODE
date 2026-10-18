const supportedTypes = new Set(['start', 'end', 'input', 'output', 'process', 'decision'])
const inputTypes = new Set(['int', 'float', 'double', 'char'])
const formatByType = { int: '%d', float: '%f', double: '%lf', char: ' %c' }
const outputFormatByType = { int: '%d', float: '%g', double: '%g', char: '%c' }
const identifierPattern = /^[A-Za-z_]\w*$/
const cKeywords = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double',
  'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long',
  'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static', 'struct',
  'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', '_Alignas',
  '_Alignof', '_Atomic', '_Bool', '_Complex', '_Generic', '_Imaginary', '_Noreturn',
  '_Static_assert', '_Thread_local',
])

function fail(message) {
  throw new Error(message)
}

function parseExpression(source, knownVariables, context) {
  const tokens = source.match(/(?:[A-Za-z_]\w*|\d+(?:\.\d+)?|'(?:[^'\\]|\\.)'|&&|\|\||==|!=|<=|>=|[()+\-*/%!<>])/g) ?? []
  if (tokens.join('').replace(/\s/g, '') !== source.replace(/\s/g, '')) {
    fail(`${context}: contains unsupported C syntax.`)
  }

  let index = 0
  const peek = () => tokens[index]
  const consume = (expected) => {
    if (tokens[index] !== expected) fail(`${context}: expected "${expected}".`)
    index += 1
  }
  const parsePrimary = () => {
    const token = peek()
    if (!token) fail(`${context}: expression is incomplete.`)
    if (token === '(') {
      index += 1
      parseOr()
      consume(')')
      return
    }
    if (/^\d/.test(token) || /^'(?:[^'\\]|\\.)'$/.test(token)) {
      index += 1
      return
    }
    if (identifierPattern.test(token)) {
      if (!knownVariables.has(token)) fail(`${context}: "${token}" is not declared or initialized.`)
      index += 1
      return
    }
    fail(`${context}: unexpected token "${token}".`)
  }
  const parseUnary = () => {
    if (['!', '+', '-'].includes(peek())) {
      index += 1
      parseUnary()
      return
    }
    parsePrimary()
  }
  const parseLeftAssociative = (next, operators) => {
    next()
    while (operators.includes(peek())) {
      index += 1
      next()
    }
  }
  const parseMultiplication = () => parseLeftAssociative(parseUnary, ['*', '/', '%'])
  const parseAddition = () => parseLeftAssociative(parseMultiplication, ['+', '-'])
  const parseComparison = () => parseLeftAssociative(parseAddition, ['<', '>', '<=', '>='])
  const parseEquality = () => parseLeftAssociative(parseComparison, ['==', '!='])
  const parseAnd = () => parseLeftAssociative(parseEquality, ['&&'])
  function parseOr() {
    parseLeftAssociative(parseAnd, ['||'])
  }
  parseOr()
  if (index !== tokens.length) fail(`${context}: unexpected token "${tokens[index]}".`)
}

function parseInputDeclarations(node) {
  const source = node.data?.detail?.trim() ?? ''
  const match = source.match(/^(?:(int|float|double|char)\s+)?([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)$/)
  if (!match) fail(`Input node "${node.id}" needs variable names, such as "int a, b".`)
  const type = match[1] ?? 'int'
  if (!inputTypes.has(type)) fail(`Input node "${node.id}" uses unsupported type "${type}".`)
  return match[2].split(',').map((name) => {
    const variableName = name.trim()
    if (cKeywords.has(variableName)) fail(`Input node "${node.id}" uses reserved C keyword "${variableName}".`)
    return { name: variableName, type, nodeId: node.id }
  })
}

function parseAssignment(node) {
  const source = node.data?.detail?.trim().replace(/;$/, '') ?? ''
  const match = source.match(/^(?:(int|float|double|char)\s+)?([A-Za-z_]\w*)\s*=\s*(.+)$/)
  if (!match) fail(`Process node "${node.id}" needs an assignment, such as "sum = a + b".`)
  const [, type, name, expression] = match
  if (cKeywords.has(name)) fail(`Process node "${node.id}" uses reserved C keyword "${name}".`)
  if (type && !inputTypes.has(type)) fail(`Process node "${node.id}" uses unsupported type "${type}".`)
  return { type, name, expression: expression.trim(), nodeId: node.id }
}

function parseOutput(node, variables) {
  const expression = node.data?.detail?.trim() ?? ''
  if (!expression) fail(`Output node "${node.id}" is missing the value to print.`)
  if (/^"(?:[^"\\]|\\.)*"$/.test(expression)) return { expression, format: '%s' }
  if (/^'(?:[^'\\]|\\.)'$/.test(expression)) return { expression, format: '%c' }
  parseExpression(expression, new Set(variables.keys()), `Output node "${node.id}"`)
  const identifier = expression.match(/^[A-Za-z_]\w*$/)?.[0]
  const type = identifier ? variables.get(identifier) : ''
  const expressionVariables = expression.match(/[A-Za-z_]\w*/g) ?? []
  const expressionTypes = expressionVariables.map((name) => variables.get(name))
  const format = outputFormatByType[type]
    ?? (expressionTypes.some((variableType) => variableType === 'float' || variableType === 'double')
      || /\d\.\d/.test(expression) ? '%g' : '%d')
  return { expression, format }
}

function getEdgeBranch(edge) {
  const value = String(edge.label ?? edge.sourceHandle ?? '').trim().toLowerCase()
  if (value === 'yes' || value === 'true') return 'yes'
  if (value === 'no' || value === 'false') return 'no'
  return ''
}

function buildGraph(nodes, edges) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) fail('The flow must contain nodes and connections.')
  const nodeById = new Map()
  for (const node of nodes) {
    if (!node?.id || nodeById.has(node.id)) fail('Every flow node must have a unique ID.')
    if (!supportedTypes.has(node.type)) fail(`Node "${node.id}" has an unsupported type.`)
    nodeById.set(node.id, node)
  }
  const starts = nodes.filter((node) => node.type === 'start')
  const ends = nodes.filter((node) => node.type === 'end')
  if (starts.length !== 1) fail(`The flow must contain exactly one Start node; found ${starts.length}.`)
  if (ends.length !== 1) fail(`The flow must contain exactly one End node; found ${ends.length}.`)

  const outgoing = new Map(nodes.map((node) => [node.id, []]))
  const incoming = new Map(nodes.map((node) => [node.id, []]))
  const edgePairs = new Set()
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      fail(`Connection "${edge.id ?? ''}" refers to a missing node.`)
    }
    if (edge.source === edge.target) fail(`Connection on node "${edge.source}" creates an unsupported cycle.`)
    const pair = `${edge.source}\u0000${edge.target}`
    if (edgePairs.has(pair)) fail(`Duplicate connection from "${edge.source}" to "${edge.target}".`)
    edgePairs.add(pair)
    outgoing.get(edge.source).push(edge)
    incoming.get(edge.target).push(edge)
  }

  const startId = starts[0].id
  const endId = ends[0].id
  const indegree = new Map(nodes.map((node) => [node.id, incoming.get(node.id).length]))
  const ready = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id)
  let visitedCount = 0
  while (ready.length) {
    const id = ready.shift()
    visitedCount += 1
    for (const edge of outgoing.get(id)) {
      indegree.set(edge.target, indegree.get(edge.target) - 1)
      if (indegree.get(edge.target) === 0) ready.push(edge.target)
    }
  }
  if (visitedCount !== nodes.length) fail('The flow contains an unsupported cycle.')

  const reachable = new Set()
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const edge of outgoing.get(id)) queue.push(edge.target)
  }
  const unreachable = nodes.filter((node) => !reachable.has(node.id))
  if (unreachable.length) fail(`Unreachable node(s): ${unreachable.map((node) => node.id).join(', ')}.`)

  const reverseReachable = new Set()
  const reverseQueue = [endId]
  while (reverseQueue.length) {
    const id = reverseQueue.shift()
    if (reverseReachable.has(id)) continue
    reverseReachable.add(id)
    for (const edge of incoming.get(id)) reverseQueue.push(edge.source)
  }
  const deadEnds = nodes.filter((node) => !reverseReachable.has(node.id))
  if (deadEnds.length) fail(`Node(s) cannot reach End: ${deadEnds.map((node) => node.id).join(', ')}.`)

  for (const node of nodes) {
    const ins = incoming.get(node.id)
    const outs = outgoing.get(node.id)
    if (node.type === 'start' && (ins.length !== 0 || outs.length !== 1)) {
      fail('Start must have no incoming connections and exactly one outgoing connection.')
    }
    if (node.type === 'end' && (ins.length === 0 || outs.length !== 0)) {
      fail('End must have at least one incoming connection and no outgoing connections.')
    }
    if (node.type !== 'start' && node.type !== 'end' && ins.length === 0) {
      fail(`Node "${node.id}" is missing an incoming connection.`)
    }
    if (node.type === 'decision') {
      if (outs.length !== 2) fail(`Decision node "${node.id}" must have exactly two outgoing connections.`)
      const branches = outs.map(getEdgeBranch)
      if (!branches.includes('yes') || !branches.includes('no') || branches[0] === branches[1]) {
        fail(`Decision node "${node.id}" needs one outgoing Yes edge and one outgoing No edge.`)
      }
    } else if (node.type !== 'end' && outs.length !== 1) {
      fail(`Node "${node.id}" must have exactly one outgoing connection.`)
    }
  }

  return { nodeById, outgoing, incoming, startId, endId }
}

function findBranchJoin(branchEdges, outgoing) {
  const reachableByBranch = branchEdges.map((edge) => {
    const distances = new Map([[edge.target, 0]])
    const queue = [edge.target]
    while (queue.length) {
      const id = queue.shift()
      for (const next of outgoing.get(id)) {
        if (!distances.has(next.target)) {
          distances.set(next.target, distances.get(id) + 1)
          queue.push(next.target)
        }
      }
    }
    return distances
  })
  const [yesDistances, noDistances] = reachableByBranch
  const common = [...yesDistances.keys()].filter((id) => noDistances.has(id))
  if (!common.length) fail('A Decision node has Yes and No paths that never rejoin.')
  common.sort((left, right) => {
    const leftMax = Math.max(yesDistances.get(left), noDistances.get(left))
    const rightMax = Math.max(yesDistances.get(right), noDistances.get(right))
    return leftMax - rightMax || yesDistances.get(left) + noDistances.get(left) - yesDistances.get(right) - noDistances.get(right)
  })
  return common[0]
}

function createCodeLines(graph, assignments, inputs, outputs) {
  const lines = []
  const emitted = new Set()
  const { nodeById, outgoing, startId, endId } = graph
  const indent = (depth) => '    '.repeat(depth)
  const push = (depth, text) => lines.push(`${indent(depth)}${text}`)
  const edgeForBranch = (edges, branch) => edges.find((edge) => getEdgeBranch(edge) === branch)

  function emitPath(firstId, stopId, depth) {
    let currentId = firstId
    while (currentId !== stopId) {
      const node = nodeById.get(currentId)
      if (!node) fail(`The flow references missing node "${currentId}".`)
      if (currentId === endId) fail('A branch reaches End before its paths rejoin.')
      if (emitted.has(currentId)) fail(`Node "${currentId}" is shared by incompatible paths; this flow structure is unsupported.`)
      emitted.add(currentId)

      if (node.type === 'decision') {
        const condition = node.data?.detail?.trim() ?? ''
        if (!condition) fail(`Decision node "${node.id}" is missing its condition.`)
        const branches = outgoing.get(node.id)
        const joinId = findBranchJoin(branches, outgoing)
        const yesEdge = edgeForBranch(branches, 'yes')
        const noEdge = edgeForBranch(branches, 'no')
        push(depth, `if (${condition}) {`)
        emitPath(yesEdge.target, joinId, depth + 1)
        push(depth, '} else {')
        emitPath(noEdge.target, joinId, depth + 1)
        push(depth, '}')
        currentId = joinId
      } else if (node.type === 'input') {
        push(depth, inputs.get(node.id))
        currentId = outgoing.get(currentId)[0].target
      } else if (node.type === 'process') {
        const assignment = assignments.get(node.id)
        push(depth, `${assignment.name} = ${assignment.expression};`)
        currentId = outgoing.get(currentId)[0].target
      } else if (node.type === 'output') {
        const output = outputs.get(node.id)
        push(depth, `printf("${output.format}\\n", ${output.expression});`)
        currentId = outgoing.get(currentId)[0].target
      } else {
        fail(`Node "${node.id}" is in an unsupported execution position.`)
      }
    }
  }

  const firstId = outgoing.get(startId)[0].target
  emitPath(firstId, endId, 1)
  if (!emitted.has(endId)) emitted.add(endId)
  return lines
}

function validateInitialization(graph, assignments, outputs) {
  const { nodeById, outgoing, startId, endId } = graph
  const visited = new Set()
  const branchEdge = (edges, branch) => edges.find((edge) => getEdgeBranch(edge) === branch)

  function visitPath(firstId, stopId, initialized) {
    let currentId = firstId
    while (currentId !== stopId && currentId !== endId) {
      const node = nodeById.get(currentId)
      if (visited.has(currentId)) fail(`Node "${currentId}" is shared by incompatible paths; this flow structure is unsupported.`)
      visited.add(currentId)

      if (node.type === 'input') {
        for (const declaration of parseInputDeclarations(node)) initialized.add(declaration.name)
        currentId = outgoing.get(currentId)[0].target
      } else if (node.type === 'process') {
        const assignment = assignments.get(node.id)
        parseExpression(assignment.expression, initialized, `Process node "${node.id}"`)
        initialized.add(assignment.name)
        currentId = outgoing.get(currentId)[0].target
      } else if (node.type === 'output') {
        const output = outputs.get(node.id)
        if (!/^"(?:[^"\\]|\\.)*"$/.test(output.expression) && !/^'(?:[^'\\]|\\.)'$/.test(output.expression)) {
          parseExpression(output.expression, initialized, `Output node "${node.id}"`)
        }
        currentId = outgoing.get(currentId)[0].target
      } else if (node.type === 'decision') {
        parseExpression(node.data.detail.trim(), initialized, `Decision node "${node.id}"`)
        const branches = outgoing.get(node.id)
        const joinId = findBranchJoin(branches, outgoing)
        const yesVariables = visitPath(branchEdge(branches, 'yes').target, joinId, new Set(initialized))
        const noVariables = visitPath(branchEdge(branches, 'no').target, joinId, new Set(initialized))
        initialized = new Set([...yesVariables].filter((name) => noVariables.has(name)))
        currentId = joinId
      } else {
        fail(`Node "${node.id}" is in an unsupported execution position.`)
      }
    }
    return initialized
  }

  visitPath(outgoing.get(startId)[0].target, endId, new Set())
}

export function generateCCode(nodes, edges) {
  const graph = buildGraph(nodes, edges)
  const variables = new Map()
  const assignments = new Map()
  const outputs = new Map()
  const inputNodes = nodes.filter((node) => node.type === 'input')

  for (const node of inputNodes) {
    for (const declaration of parseInputDeclarations(node)) {
      if (variables.has(declaration.name)) fail(`Variable "${declaration.name}" is declared more than once.`)
      variables.set(declaration.name, declaration.type)
    }
  }
  for (const node of nodes.filter((item) => item.type === 'process')) {
    const assignment = parseAssignment(node)
    if (assignment.type) {
      if (variables.has(assignment.name)) fail(`Variable "${assignment.name}" is declared more than once.`)
      variables.set(assignment.name, assignment.type)
    }
    assignments.set(node.id, assignment)
  }
  for (const assignment of assignments.values()) {
    if (!variables.has(assignment.name)) fail(`Process node "${assignment.nodeId}" assigns to undeclared variable "${assignment.name}".`)
    parseExpression(assignment.expression, new Set(variables.keys()), `Process node "${assignment.nodeId}"`)
  }
  for (const node of nodes.filter((item) => item.type === 'decision')) {
    const condition = node.data?.detail?.trim() ?? ''
    if (!condition) fail(`Decision node "${node.id}" is missing its condition.`)
    parseExpression(condition, new Set(variables.keys()), `Decision node "${node.id}"`)
  }
  for (const node of nodes.filter((item) => item.type === 'output')) {
    outputs.set(node.id, parseOutput(node, variables))
  }
  validateInitialization(graph, assignments, outputs)

  const declarations = [...variables.entries()].map(([name, type]) => `    ${type} ${name};`)
  const inputStatements = new Map()
  for (const node of inputNodes) {
    const inputVariables = parseInputDeclarations(node)
    const format = inputVariables.map(({ type }) => formatByType[type]).join(' ')
    const argumentsList = inputVariables.map(({ name }) => `&${name}`).join(', ')
    inputStatements.set(node.id, `scanf("${format}", ${argumentsList});`)
  }
  const body = createCodeLines(graph, assignments, inputStatements, outputs)

  const codeLines = [
    '#include <stdio.h>',
    '',
    'int main(void) {',
    ...declarations,
    ...(declarations.length && inputNodes.length ? [''] : []),
    ...body,
    '    return 0;',
    '}',
  ]
  return codeLines.join('\n')
}
