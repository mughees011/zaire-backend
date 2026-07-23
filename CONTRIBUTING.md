# Contributing to ZAIRE Backend

Thank you for your interest in contributing. ZAIRE is a focused project, and we welcome contributions that improve the stability, performance, and developer experience of the Engineer Mode pipeline.

---

## Before You Start

1. **Check open issues** — your idea may already be tracked or in progress
2. **Open an issue first** for any non-trivial change — this avoids wasted effort if the direction doesn't align
3. **Read the README** to understand the architecture before touching the LLM orchestration or file pipeline code

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/mughees011/zaire-backend.git
cd zaire-backend

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Copy and fill in your environment variables
cp .env.example .env
# Edit .env with real keys

# Start the backend
npm start

# In a second terminal — start the Python sidecar
python agent_daemon.py
```

---

## What We Welcome

| Type | Welcome? |
|---|---|
| Bug fixes with a clear reproduction case | ✅ Yes |
| Performance improvements to LLM routing or scaffold generation | ✅ Yes |
| New Engineer Mode features aligned with the roadmap | ✅ Yes (open an issue first) |
| Security hardening | ✅ Especially welcome |
| New AI provider integrations | ✅ With tests |
| Documentation improvements | ✅ Yes |
| Refactoring without behavioural change | ⚠️ Discuss first |
| Large architectural rewrites | ❌ Not without prior agreement |

---

## Code Style

- **JavaScript:** follow the existing style — no semicolons at end of blocks, 2-space indent, single quotes for strings
- **Python:** PEP 8, 4-space indent
- **No linter is enforced yet** — match the style of the file you're editing
- Keep functions small and focused; if a function exceeds roughly 60 lines, consider splitting it
- Add a comment above any non-obvious logic, especially anything involving path manipulation or LLM prompt construction

---

## Submitting a Pull Request

1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b fix/my-descriptive-fix-name
   ```

2. **Make your changes.** Keep commits atomic and descriptive:
   ```
   fix: correctly split POSIX paths before path.join in materializeProject
   feat: add buildDesignNarrative for deterministic assumptions generation
   docs: update README with new engineer route table
   ```

3. **Test manually** — there are no automated tests yet, so verify your change with a real Engineer Mode run if it touches scaffold generation, export, or LLM routing

4. **Open a Pull Request** targeting the `main` branch with:
   - A clear title using the same prefix convention (`fix:`, `feat:`, `docs:`, `refactor:`, `security:`)
   - A description of what changed and why
   - Steps to reproduce the bug, if it's a bug fix
   - Screenshots or logs if the change affects any visible output

---

## Important Files — Handle with Care

| File | Risk | Note |
|---|---|---|
| `index.js` | High | Central route file — any change here affects all routes |
| `services/engineer_workflow.js` | High | Core scaffold generation — test with real projects |
| `services/engineer_qa_repair.js` | High | Path handling — test export and materialize on Windows |
| `middleware/license_enforcement.js` | Critical | Do not weaken license checks |
| `services/design_intelligence.js` | Medium | LLM prompt structure is sensitive |

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `refactor`, `security`, `perf`, `test`, `chore`

---

## Code of Conduct

All contributors are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Questions?

Open a GitHub Discussion, or create an Issue tagged `question`.