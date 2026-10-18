import assert from 'node:assert/strict'
import test from 'node:test'
import { generateCCode } from './cGenerator.js'
import { sampleFlows } from '../data/sampleFlows.js'

test('generates C for the sum sample with declarations, scanf, assignment, and printf', () => {
  const { nodes, edges } = sampleFlows.sum
  const code = generateCCode(nodes, edges)

  assert.match(code, /#include <stdio\.h>/)
  assert.match(code, /int main\(void\)/)
  assert.match(code, /scanf\("%d %d", &a, &b\);/)
  assert.match(code, /sum = a \+ b;/)
  assert.match(code, /printf\("%d\\n", sum\);/)
  assert.match(code, /return 0;/)
})

test('generates labeled Yes/No branches for the even-or-odd sample', () => {
  const { nodes, edges } = sampleFlows.evenOdd
  const code = generateCCode(nodes, edges)

  assert.match(code, /if \(number % 2 == 0\) \{/)
  assert.match(code, /printf\("%s\\n", "Even"\);/)
  assert.match(code, /\} else \{/)
  assert.match(code, /printf\("%s\\n", "Odd"\);/)
})

test('rejects a graph with no Start node', () => {
  const { nodes, edges } = sampleFlows.sum
  assert.throws(() => generateCCode(nodes.filter((node) => node.type !== 'start'), edges), /exactly one Start/)
})

test('rejects missing node connections', () => {
  const { nodes, edges } = sampleFlows.sum
  assert.throws(() => generateCCode(nodes, edges.slice(0, -1)), /Unreachable node/)
})

test('rejects missing input fields and undeclared assignment targets', () => {
  const inputFlow = structuredClone(sampleFlows.sum)
  inputFlow.nodes.find((node) => node.type === 'input').data.detail = ''
  assert.throws(() => generateCCode(inputFlow.nodes, inputFlow.edges), /needs variable names/)

  const assignmentFlow = structuredClone(sampleFlows.sum)
  assignmentFlow.nodes.find((node) => node.type === 'process').data.detail = 'total = a + b'
  assert.throws(() => generateCCode(assignmentFlow.nodes, assignmentFlow.edges), /undeclared variable "total"/)
})

test('rejects a Decision without labeled Yes and No connections', () => {
  const { nodes, edges } = sampleFlows.evenOdd
  const invalidEdges = edges.map((edge) => edge.source === 'decision' && edge.label === 'No'
    ? { ...edge, label: 'Maybe', sourceHandle: 'maybe' }
    : edge)
  assert.throws(() => generateCCode(nodes, invalidEdges), /one outgoing Yes edge and one outgoing No edge/)
})

test('rejects connections that reference missing nodes', () => {
  const { nodes, edges } = sampleFlows.sum
  const invalidEdges = edges.map((edge, index) => index === 0 ? { ...edge, target: 'missing' } : edge)
  assert.throws(() => generateCCode(nodes, invalidEdges), /refers to a missing node/)
})

test('rejects cycles, even when the cycle is disconnected from Start', () => {
  const nodes = [
    { id: 'start', type: 'start', data: {} },
    { id: 'end', type: 'end', data: {} },
    { id: 'first', type: 'process', data: { detail: 'x = 1' } },
    { id: 'second', type: 'process', data: { detail: 'x = 1' } },
  ]
  const edges = [
    { source: 'start', target: 'end' },
    { source: 'first', target: 'second' },
    { source: 'second', target: 'first' },
  ]
  assert.throws(() => generateCCode(nodes, edges), /unsupported cycle/)
})

test('rejects unreachable nodes', () => {
  const { nodes, edges } = sampleFlows.sum
  const orphan = { id: 'orphan', type: 'process', data: { detail: 'int value = 1' } }
  assert.throws(() => generateCCode([...nodes, orphan], edges), /Unreachable node/)
})

test('rejects unsupported expression syntax instead of emitting raw C', () => {
  const flow = structuredClone(sampleFlows.sum)
  flow.nodes.find((node) => node.type === 'process').data.detail = 'int sum = system("bad")'
  assert.throws(() => generateCCode(flow.nodes, flow.edges), /unsupported C syntax/)
})

test('rejects variables used before their input or assignment node executes', () => {
  const flow = structuredClone(sampleFlows.sum)
  flow.edges = [
    { source: 'start', target: 'sum' },
    { source: 'sum', target: 'input' },
    { source: 'input', target: 'output' },
    { source: 'output', target: 'end' },
  ]
  assert.throws(() => generateCCode(flow.nodes, flow.edges), /not declared or initialized/)
})
