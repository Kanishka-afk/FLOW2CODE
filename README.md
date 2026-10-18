# Flow2Code — Flowchart to C Code Generator

Convert visual flowcharts into readable C code with **Flow2Code**, a React-based web application designed to make programming logic easier to visualize and translate into code.

## Overview

Flow2Code provides a visual workspace where users can build flowcharts using nodes and connections, then generate corresponding C code. The project explores how graphical program logic can be translated into structured C statements.

## Features

- **Visual flowchart editor** — Create and connect flowchart nodes.
- **Flowchart symbols** — Start, End, Input, Output, Process, and Decision.
- **C code generation** — Translate supported flowchart logic into C code.
- **Code preview** — View the generated code in the interface.
- **Code export** — Copy or download generated C code, if supported by the current build.
- **Validation** — Display errors for unsupported or invalid flowchart structures, where implemented.

## Tech Stack

- React
- JavaScript
- Vite
- React Flow (`@xyflow/react`)
- CSS

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm
- Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Kanishka-afk/FLOW2CODE.git
   ```

2. Open the project directory:

   ```bash
   cd FLOW2CODE
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed in your terminal.

## How to Use

1. Open Flow2Code in your browser.
2. Add flowchart nodes using the toolbar.
3. Enter the appropriate logic or expressions in each node.
4. Connect the nodes in the intended execution order.
5. Click **Generate Code**.
6. Review the generated C code and copy or download it if those controls are available.

> Generated C code should be reviewed and tested with a C compiler before use. Browser-based code preview does not, by itself, compile or execute C.

## Project Structure

```text
FLOW2CODE/
├── public/
├── src/
│   ├── components/
│   ├── App.jsx
│   ├── main.jsx
│   └── ...
├── index.html
├── package.json
└── README.md
```

*The exact source structure may vary as the project evolves.*

## Future Improvements

- Support more complex branching and loop structures.
- Improve flowchart validation and error reporting.
- Add more sample algorithms and test cases.
- Integrate optional C compilation and execution.

## Contributing

Suggestions and improvements are welcome. Fork the repository, create a feature branch, and submit a pull request.

## Author

**Kanishka Chauhan**

GitHub: [@Kanishka-afk](https://github.com/Kanishka-afk)

---

Built as a project exploring visual programming and automatic C code generation.