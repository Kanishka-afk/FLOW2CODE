export const sampleFlows = {
  sum: {
    name: 'Sum of Two Numbers',
    nodes: [
      { id: 'start', type: 'start', position: { x: 340, y: 24 }, data: { label: 'Start' } },
      { id: 'input', type: 'input', position: { x: 326, y: 128 }, data: { label: 'Read two numbers', detail: 'int a, b' } },
      { id: 'sum', type: 'process', position: { x: 326, y: 262 }, data: { label: 'Calculate sum', detail: 'int sum = a + b' } },
      { id: 'output', type: 'output', position: { x: 326, y: 392 }, data: { label: 'Print sum', detail: 'sum' } },
      { id: 'end', type: 'end', position: { x: 340, y: 522 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'e-start-input', source: 'start', target: 'input' },
      { id: 'e-input-sum', source: 'input', target: 'sum' },
      { id: 'e-sum-output', source: 'sum', target: 'output' },
      { id: 'e-output-end', source: 'output', target: 'end' },
    ],
    tests: [
      { name: 'Add positive numbers', input: '2 3', expected: '5' },
      { name: 'Add a negative number', input: '-4 9', expected: '5' },
    ],
  },
  evenOdd: {
    name: 'Even or Odd',
    nodes: [
      { id: 'start', type: 'start', position: { x: 340, y: 24 }, data: { label: 'Start' } },
      { id: 'input', type: 'input', position: { x: 326, y: 128 }, data: { label: 'Read a number', detail: 'int number' } },
      { id: 'decision', type: 'decision', position: { x: 320, y: 260 }, data: { label: 'Is it even?', detail: 'number % 2 == 0' } },
      { id: 'even', type: 'output', position: { x: 116, y: 420 }, data: { label: 'Print even', detail: '"Even"' } },
      { id: 'odd', type: 'output', position: { x: 522, y: 420 }, data: { label: 'Print odd', detail: '"Odd"' } },
      { id: 'end', type: 'end', position: { x: 340, y: 565 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'e-start-input', source: 'start', target: 'input' },
      { id: 'e-input-decision', source: 'input', target: 'decision' },
      { id: 'e-decision-even', source: 'decision', sourceHandle: 'yes', target: 'even', label: 'Yes', type: 'smoothstep' },
      { id: 'e-decision-odd', source: 'decision', sourceHandle: 'no', target: 'odd', label: 'No', type: 'smoothstep' },
      { id: 'e-even-end', source: 'even', target: 'end', type: 'smoothstep' },
      { id: 'e-odd-end', source: 'odd', target: 'end', type: 'smoothstep' },
    ],
    tests: [
      { name: 'Even number', input: '8', expected: 'Even' },
      { name: 'Odd number', input: '5', expected: 'Odd' },
    ],
  },
}

export const defaultSampleId = 'sum'
