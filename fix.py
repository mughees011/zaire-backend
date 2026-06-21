import re

with open('computer_use.py', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'(# ─+\n# AUTONOMOUS VISION LOOP.*?)(?=# ─+\n# HEALTH)', text, re.DOTALL)
if match:
    code = match.group(1)
    # Fast api modifications
    code = code.replace("@app.route('/task/run', methods=['POST'])", "@app.post('/task/run')")
    code = code.replace("@app.route('/task/status', methods=['GET'])", "@app.get('/task/status')")
    code = code.replace("@app.route('/task/stop', methods=['POST'])", "@app.post('/task/stop')")
    code = code.replace("def run_task():", "class TaskRunData(BaseModel):\n    task: str\n\n@app.post('/task/run')\ndef run_task(req: TaskRunData):")
    code = code.replace("data = request.get_json()\n    task = (data.get(\"task\") or \"\").strip()", "task = req.task.strip()")
    code = code.replace("return jsonify(", "return ")
    code = code.replace("}), 409", "}")
    code = code.replace("}), 400", "}")
    code = code.replace("from flask import jsonify, request", "")
    with open('agent_daemon.py', 'a', encoding='utf-8') as f:
        f.write('\n\n' + code)
    print('Done.')
else:
    print('Not found')
