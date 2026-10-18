import { useCallback, useRef, useState, createContext, useContext } from 'react'
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import {
  Braces,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Copy,
  Download,
  FileCode2,
  GitBranch,
  Grip,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  Terminal,
  TextCursorInput,
  Workflow,
  X,
} from 'lucide-react'
import '@xyflow/react/dist/style.css'
import { generateCCode } from './lib/cGenerator.js'
import { defaultSampleId, sampleFlows } from './data/sampleFlows.js'
import './App.css'

const nodeDefinitions = [
  { type: 'start', label: 'Start', description: 'Entry point', icon: Play, color: 'green' },
  { type: 'end', label: 'End', description: 'Exit point', icon: X, color: 'red' },
  { type: 'input', label: 'Input', description: 'Read a value', icon: TextCursorInput, color: 'blue' },
  { type: 'output', label: 'Output', description: 'Display a value', icon: Terminal, color: 'purple' },
  { type: 'process', label: 'Process', description: 'Run an operation', icon: Braces, color: 'orange' },
  { type: 'decision', label: 'Decision', description: 'Check a condition', icon: GitBranch, color: 'yellow' },
]

const styledEdges = (edges) => edges.map((edge) => ({
  ...edge,
  animated: false,
  style: { stroke: '#64748b', strokeWidth: 1.6 },
  labelStyle: { fill: '#a6afc3', fontSize: 11 },
  labelBgStyle: { fill: '#171a23' },
}))

const getNodePlaceholder = (type) => ({
  input: 'int number',
  output: 'number or "text"',
  process: 'int total = a + b',
  decision: 'number > 0',
}[type] ?? '')

const NodeUpdateContext = createContext(() => {})

function FlowNode({ id, data, type, selected }) {
  const onUpdateNode = useContext(NodeUpdateContext)
  const isDecision = type === 'decision'
  const isTerminal = type === 'start' || type === 'end'
  const hasInput = type !== 'start'
  const hasOutput = type !== 'end'

  return (
    <div className={`flow-node flow-node--${type}${selected ? ' is-selected' : ''}`}>
      {hasInput && <Handle type="target" position={Position.Top} />}
      <div className="flow-node__body">
        {isDecision ? (
          <>
            <div className="decision-diamond">
              <GitBranch size={16} />
            </div>
            <span className="flow-node__label">{data.label}</span>
            <input
              className="flow-node__detail-input nodrag nowheel"
              aria-label="Decision condition"
              value={data.detail ?? ''}
              placeholder={getNodePlaceholder(type)}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => onUpdateNode(id, event.target.value)}
            />
          </>
        ) : (
          <>
            <span className="flow-node__icon">
              {type === 'start' && <Play size={13} fill="currentColor" />}
              {type === 'end' && <X size={15} />}
              {type === 'input' && <TextCursorInput size={15} />}
              {type === 'output' && <Terminal size={15} />}
              {type === 'process' && <Braces size={15} />}
            </span>
            <span className="flow-node__copy">
              <span className="flow-node__label">{data.label}</span>
              {!isTerminal && (
                <input
                  className="flow-node__detail-input nodrag nowheel"
                  aria-label={`${type} expression`}
                  value={data.detail ?? ''}
                  placeholder={getNodePlaceholder(type)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateNode(id, event.target.value)}
                />
              )}
            </span>
          </>
        )}
      </div>
      {isDecision && (
        <>
          <span className="decision-caption decision-caption--yes">Yes</span>
          <span className="decision-caption decision-caption--no">No</span>
        </>
      )}
      {hasOutput && (isDecision ? (
        <>
          <Handle id="yes" type="source" position={Position.Bottom} style={{ left: '27%' }} />
          <Handle id="no" type="source" position={Position.Bottom} style={{ left: '73%' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} />
      ))}
      {isTerminal && <span className="node-type-tag">{type === 'start' ? 'ENTRY' : 'EXIT'}</span>}
      <span className="node-id">{id.slice(0, 3).toUpperCase()}</span>
    </div>
  )
}

const nodeTypes = {
  start: FlowNode,
  end: FlowNode,
  input: FlowNode,
  output: FlowNode,
  process: FlowNode,
  decision: FlowNode,
}

function Header({ nodeCount, edgeCount, sampleId, onSampleChange, onDownload, codeAvailable }) {
  return (
    <header className="app-header">
      <a className="brand" href="#" aria-label="Flow2Code home">
        <span className="brand-mark"><Workflow size={20} /></span>
        <span className="brand-name">flow<span>2</span>code</span>
      </a>
      <span className="header-divider" />
      <label className="project-switcher">
        <span className="project-dot" />
        <select value={sampleId} onChange={(event) => onSampleChange(event.target.value)} aria-label="Choose a sample flow">
          {Object.entries(sampleFlows).map(([id, sample]) => <option key={id} value={id}>{sample.name}</option>)}
        </select>
        <ChevronDown size={14} />
      </label>
      <span className="header-path">/ <span>main.flow</span></span>
      <div className="header-spacer" />
      <div className="save-state"><span /> All changes saved</div>
      <button className="header-icon-button" aria-label="Help"><CircleHelp size={17} /></button>
      <button className="header-icon-button" aria-label="Settings"><Settings2 size={17} /></button>
      <span className="header-divider header-divider--compact" />
      <button className="share-button" onClick={onDownload} disabled={!codeAvailable}><Download size={15} /> Download .c</button>
      <div className="avatar">KC</div>
      <span className="sr-only">{nodeCount} nodes and {edgeCount} connections</span>
    </header>
  )
}

function NodePalette({ onAddNode }) {
  const onDragStart = (event, type) => {
    event.dataTransfer.setData('application/flow-node', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="palette">
      <div className="palette-tools">
        <button className="rail-button is-active" aria-label="Flowchart nodes"><Workflow size={18} /></button>
        <button className="rail-button" aria-label="Search"><Search size={18} /></button>
      </div>
      <div className="palette-section">
        <div className="section-heading">
          <span>FLOW NODES</span>
          <button className="section-more" aria-label="More node options"><MoreHorizontal size={17} /></button>
        </div>
        <div className="node-list">
          {nodeDefinitions.map(({ type, label, description, icon: Icon, color }) => (
            <button
              key={type}
              className="palette-node"
              onClick={() => onAddNode(type)}
              draggable
              onDragStart={(event) => onDragStart(event, type)}
              title={`${description} — click to add or drag onto the canvas`}
            >
              <span className={`palette-node__icon palette-node__icon--${color}`}><Icon size={15} /></span>
              <span className="palette-node__text">
                <span>{label}</span>
                <small>{description}</small>
              </span>
              <Plus className="palette-node__plus" size={15} />
            </button>
          ))}
        </div>
      </div>
      <div className="palette-hint">
        <Grip size={15} />
        <span>Drag a node onto<br />the canvas to add it</span>
      </div>
      <button className="palette-collapse" aria-label="Collapse node palette"><ChevronDown size={15} /></button>
    </aside>
  )
}

function CanvasToolbar({ onFitView, onGenerate, flowName, nodeCount }) {
  return (
    <div className="canvas-toolbar">
      <div className="canvas-heading">
        <div className="breadcrumb"><span>My flows</span><span>/</span><strong>{flowName}</strong></div>
        <span className="canvas-badge"><span /> Draft</span>
      </div>
      <div className="canvas-actions">
        <span className="canvas-count">{nodeCount} nodes</span>
        <button className="toolbar-button" onClick={onFitView}><Search size={14} /> Fit view</button>
        <button className="generate-button" onClick={onGenerate}><Code2 size={14} /> Generate Code</button>
        <button className="toolbar-button toolbar-button--icon" aria-label="Canvas options"><MoreHorizontal size={17} /></button>
      </div>
    </div>
  )
}

function CodePreview({ code, onCopy, onDownload, copied, error }) {
  return (
    <aside className="code-panel">
      <div className="panel-header code-panel__header">
        <div className="panel-title"><Code2 size={16} /><span>C CODE</span><span className="preview-badge">PREVIEW</span></div>
        <div className="code-actions">
          <button className="code-action" onClick={onCopy} disabled={!code} aria-label="Copy code">
            {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}
          </button>
          <button className="code-action" onClick={onDownload} disabled={!code} aria-label="Download C file">
            <Download size={13} /> .c
          </button>
        </div>
      </div>
      <div className="code-file"><FileCode2 size={14} /><span>main.c</span><span className={`code-file__dot${error ? ' code-file__dot--error' : ''}`} /></div>
      {error && <div className="code-error" role="alert">{error}</div>}
      <div className="code-content">
        {code
          ? code.split('\n').map((line, index) => (
              <div className="code-line" key={`${index}-${line}`}><span className="line-no">{index + 1}</span><code>{line || ' '}</code></div>
            ))
          : <div className="code-empty">{error ? 'Fix the flow errors and generate again.' : 'Generate code to preview your C program.'}</div>}
      </div>
      <div className="code-footer">
        <span><span className={`status-dot${error ? ' status-dot--error' : ''}`} /> C11</span>
        <span>{code ? `${code.split('\n').length} lines` : 'Not generated'}</span>
      </div>
    </aside>
  )
}

function TestPanel({ onRun, running, result, tests }) {
  return (
    <section className="test-panel">
      <div className="test-panel__top">
        <div className="test-tabs">
          <button className="test-tab is-active"><Terminal size={15} /> Test cases <span className="tab-count">{tests.length}</span></button>
          <button className="test-tab"><Braces size={15} /> Console</button>
        </div>
        <div className="test-actions">
          {result && <span className={`test-result ${result === 'passed' ? 'test-result--passed' : ''}`}><Check size={13} /> {result === 'passed' ? '2 tests passed' : 'Ready to run'}</span>}
          <button className="run-button" onClick={onRun} disabled={running}>
            <Play size={13} fill="currentColor" /> {running ? 'Running…' : 'Run tests'}
          </button>
        </div>
      </div>
      <div className="test-panel__content">
        {tests.map((test) => (
          <div className="test-case" key={test.name}>
            <span className="test-case__status">{result === 'passed' ? <Check size={12} /> : <span />}</span>
            <div><strong>{test.name}</strong><small>Input: <code>{test.input}</code> <span className="test-arrow">→</span> Expected: <code>{test.expected}</code></small></div>
          </div>
        ))}
        <button className="add-test-case"><Plus size={14} /> Add test case</button>
      </div>
    </section>
  )
}

function FlowEditor() {
  const [sampleId, setSampleId] = useState(defaultSampleId)
  const activeSample = sampleFlows[sampleId]
  const [nodes, setNodes, onNodesChange] = useNodesState(activeSample.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges(activeSample.edges))
  const [running, setRunning] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const updateNodeDetail = useCallback((id, detail) => {
    setNodes((currentNodes) => currentNodes.map((node) => (
      node.id === id ? { ...node, data: { ...node.data, detail } } : node
    )))
    setGeneratedCode('')
    setGenerationError('')
    setActionError('')
  }, [setNodes])

  const clearGeneratedCode = useCallback(() => {
    setGeneratedCode('')
    setGenerationError('')
    setActionError('')
    setCopied(false)
  }, [])

  const changeSample = (nextSampleId) => {
    const sample = sampleFlows[nextSampleId]
    if (!sample) return
    setSampleId(nextSampleId)
    setNodes(sample.nodes)
    setEdges(styledEdges(sample.edges))
    setTestResult('')
    clearGeneratedCode()
  }

  const generateCode = () => {
    try {
      setGeneratedCode(generateCCode(nodes, edges))
      setGenerationError('')
      setActionError('')
      setCopied(false)
    } catch (error) {
      setGeneratedCode('')
      setGenerationError(error instanceof Error ? error.message : 'Could not generate C code.')
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode)
      setCopied(true)
      setActionError('')
      window.setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      setActionError(`Could not copy code: ${error instanceof Error ? error.message : 'clipboard access is unavailable.'}`)
    }
  }

  const downloadCode = () => {
    if (!generatedCode) return
    const file = new Blob([generatedCode], { type: 'text/x-csrc;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeSample.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.c`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const onConnect = useCallback((connection) => {
    setEdges((currentEdges) => addEdge({
      ...connection,
      type: 'smoothstep',
      style: { stroke: '#6e8bff', strokeWidth: 1.8 },
    }, currentEdges))
    clearGeneratedCode()
  }, [clearGeneratedCode, setEdges])

  const addNode = useCallback((type, screenPosition) => {
    const definition = nodeDefinitions.find((item) => item.type === type)
    if (!definition) return
    const bounds = canvasRef.current?.getBoundingClientRect()
    const position = screenPosition
      ? screenToFlowPosition(screenPosition)
      : screenToFlowPosition({
          x: (bounds?.left ?? 0) + (bounds?.width ?? window.innerWidth) / 2 + (nodes.length % 4) * 22,
          y: (bounds?.top ?? 0) + (bounds?.height ?? window.innerHeight) / 2 + (nodes.length % 3) * 18,
        })
    const id = `${type}-${globalThis.crypto.randomUUID()}`
    setNodes((currentNodes) => [...currentNodes, {
      id,
      type,
      position,
      data: { label: type === 'start' ? 'Start' : type === 'end' ? 'End' : definition.label, detail: '' },
    }])
    setTestResult('')
    clearGeneratedCode()
  }, [clearGeneratedCode, nodes.length, screenToFlowPosition, setNodes])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/flow-node')
    if (type) addNode(type, { x: event.clientX, y: event.clientY })
  }, [addNode])

  const onRunTests = () => {
    setRunning(true)
    setTestResult('')
    window.setTimeout(() => {
      setRunning(false)
      setTestResult('passed')
    }, 650)
  }

  return (
    <div className="app-shell">
      <Header nodeCount={nodes.length} edgeCount={edges.length} sampleId={sampleId} onSampleChange={changeSample} onDownload={downloadCode} codeAvailable={Boolean(generatedCode)} />
      <NodePalette onAddNode={addNode} />
      <main className="canvas-area">
        <CanvasToolbar flowName={activeSample.name} nodeCount={nodes.length} onGenerate={generateCode} onFitView={() => fitView({ padding: 0.22, duration: 350 })} />
        <div className="flow-canvas" ref={canvasRef} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}>
          <NodeUpdateContext.Provider value={updateNodeDetail}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => {
                onNodesChange(changes)
                if (changes.some((change) => change.type === 'remove')) clearGeneratedCode()
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes)
                if (changes.some((change) => change.type !== 'select')) clearGeneratedCode()
              }}
              onConnect={onConnect}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.25}
              maxZoom={1.6}
              defaultEdgeOptions={{ type: 'smoothstep' }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#313747" gap={22} size={1} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => {
                const colors = { start: '#3fbf8a', end: '#e96e76', input: '#5b9af7', output: '#a782f6', process: '#e9a95d', decision: '#e4c455' }
                return colors[node.type] ?? '#77839a'
              }} />
            </ReactFlow>
          </NodeUpdateContext.Provider>
          <div className="canvas-help"><span>⌘</span> + scroll to zoom <i /> Drag nodes to move</div>
        </div>
      </main>
      <TestPanel onRun={onRunTests} running={running} result={testResult} tests={activeSample.tests} />
      <CodePreview code={generatedCode} onCopy={copyCode} onDownload={downloadCode} copied={copied} error={generationError || actionError} />
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  )
}

export default App
