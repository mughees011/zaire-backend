with open('agent_daemon.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('    })', '    }')
text = text.replace('return {"success": False, "error": "No task running."})', 'return {"success": False, "error": "No task running."}')

with open('agent_daemon.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Fixed.')
