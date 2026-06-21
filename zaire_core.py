import sys
import os
import runpy

# Import all daemons explicitly so PyInstaller bundles them automatically.
try:
    import agent_daemon
    import airllm_service
    import alarm_scheduler
    import architecture_battle
    import attention_monitor
    import clipboard_daemon
    import computer_use
    import daily_briefing
    import daily_routine
    import developer_api
    import emotional_intelligence
    import exam_simulator
    import face_security
    import file_watcher
    import goal_engine
    import goap_planner
    import knowledge_graph
    import local_llm_service
    import observer_daemon
    import process_monitor
    import pushbullet_service
    import research_synth
    import self_healing_daemon
    import smart_home
    import system_health
    import vector_memory
    import weekly_briefing
except ImportError as e:
    print(f"[CORE] Warning: Missing a module during import: {e}")

# Note: zaire_boot is the entry point for licensing UI and is handled separately.

def main():
    if len(sys.argv) < 2:
        print("Usage: zaire_core <daemon_name.py>")
        sys.exit(1)
        
    daemon_name = sys.argv[1]
    
    # Trim .py if passed
    if daemon_name.endswith('.py'):
        daemon_name = daemon_name[:-3]
    
    # Strip any directory paths if they were passed (e.g., from index.js)
    daemon_name = os.path.basename(daemon_name)
    
    print(f"[CORE] Launching embedded daemon: {daemon_name}")
    
    # Adjust sys.argv so the daemon thinks it was run directly
    sys.argv = [daemon_name + ".py"] + sys.argv[2:]
    
    try:
        runpy.run_module(daemon_name, run_name="__main__")
    except Exception as e:
        print(f"[CORE] Error executing {daemon_name}: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
