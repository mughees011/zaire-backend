import socketio
import time

sio = socketio.Client()

@sio.event
def connect():
    print("Connected to ZAIRE Backend")
    # Trigger a complex goal that requires GOAP
    goal = "I want you to research the current price of Bitcoin, create a summary report, and then draft a basic trading strategy based on it."
    print(f"Sending Goal: {goal}")
    sio.emit('user_message', goal)

@sio.on('ai_text_delta')
def on_delta(delta):
    print(delta, end='', flush=True)

@sio.on('ai_text_complete')
def on_complete():
    print("\n--- GOAL EXECUTION COMPLETE ---")
    sio.disconnect()

if __name__ == '__main__':
    try:
        sio.connect('http://localhost:3001')
        sio.wait()
    except Exception as e:
        print(f"Connection failed: {e}")
