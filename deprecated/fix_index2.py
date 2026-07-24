with open('index.js', 'r', encoding='utf-8') as f:
    c = f.read()

target = """    const augmentedSystemPrompt = dynamicBase + (memoryContext || "");"""

replacement = """    let engineerContext = "";
    if (activeMode === "ENGINEER") {
      engineerContext = "\\n\\n[ENGINEER MODE ACTIVE]\\nAct as a strict, direct, code-focused engineer specialist. Provide exact code, files, and architectural guidance without generic AI pleasantries.";
    }
    const augmentedSystemPrompt = dynamicBase + engineerContext + (memoryContext || "");"""

if target in c:
    c = c.replace(target, replacement)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Injected engineer context!")
else:
    print("Target not found.")
