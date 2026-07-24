"""
ZAIRE GOAP Planner — Goal-Oriented Action Planning
Implements A* search to find the most efficient path of specialist actions to achieve a goal.
Inspired by gaming AI and the Ruflo framework.
"""

import heapq
import json
from typing import List, Dict, Any, Optional

class Action:
    def __init__(self, name: str, preconditions: Dict[str, Any], effects: Dict[str, Any], cost: int, specialist: str):
        self.name = name
        self.preconditions = preconditions
        self.effects = effects
        self.cost = cost
        self.specialist = specialist

    def is_usable_in(self, state: Dict[str, Any]) -> bool:
        """Checks if all preconditions are met in the current state."""
        for key, value in self.preconditions.items():
            if state.get(key) != value:
                return False
        return True

    def apply(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Returns a new state after applying the effects."""
        new_state = state.copy()
        new_state.update(self.effects)
        return new_state

    def __repr__(self):
        return f"Action({self.name}, {self.specialist})"

class GOAPPlanner:
    def __init__(self):
        # Define the global capabilities of ZAIRE specialists
        self.actions = [
            Action("RESEARCH", {}, {"has_knowledge": True}, 1, "PROFESSOR"),
            Action("DEEP_ANALYSIS", {"has_knowledge": True}, {"has_analysis": True}, 2, "PROFESSOR"),
            Action("MARKET_SCAN", {}, {"has_market_data": True}, 1, "TRADER"),
            Action("BACKTEST_STRATEGY", {"has_market_data": True}, {"has_strategy": True}, 3, "TRADER"),
            Action("EXECUTE_TRADE", {"has_strategy": True}, {"trade_complete": True}, 2, "TRADER"),
            Action("SCAFFOLD_PROJECT", {}, {"has_structure": True}, 1, "ENGINEER"),
            Action("IMPLEMENT_LOGIC", {"has_structure": True, "has_knowledge": True}, {"has_code": True}, 4, "ENGINEER"),
            Action("TEST_AND_DEBUG", {"has_code": True}, {"code_verified": True}, 2, "ENGINEER"),
            Action("FINALIZE_BRIEFING", {"has_knowledge": True, "has_analysis": True}, {"report_ready": True}, 1, "BUSINESS"),
            Action("VISUAL_SYNTHESIS", {"has_analysis": True}, {"has_ui_mockup": True}, 2, "DESIGN_INTELLIGENCE")
        ]

    def plan(self, start_state: Dict[str, Any], goal_state: Dict[str, Any]) -> Optional[List[Action]]:
        """Finds the optimal path from start_state to goal_state using A*."""
        
        # Priority queue for A*: (f_score, h_score, current_state, path)
        # f_score = cost_so_far + heuristic
        
        start_node = (0, 0, start_state, [])
        queue = [start_node]
        visited = []

        while queue:
            f, g, current_state, path = heapq.heappop(queue)

            # Check if goal is reached
            if self._goal_met(current_state, goal_state):
                return path

            state_hash = json.dumps(current_state, sort_keys=True)
            if state_hash in visited:
                continue
            visited.append(state_hash)

            # Explore possible actions
            for action in self.actions:
                if action.is_usable_in(current_state):
                    next_state = action.apply(current_state)
                    next_g = g + action.cost
                    next_f = next_g + self._heuristic(next_state, goal_state)
                    heapq.heappush(queue, (next_f, next_g, next_state, path + [action]))

        return None

    def _goal_met(self, current_state: Dict[str, Any], goal_state: Dict[str, Any]) -> bool:
        for key, value in goal_state.items():
            if current_state.get(key) != value:
                return False
        return True

    def _heuristic(self, state: Dict[str, Any], goal_state: Dict[str, Any]) -> int:
        """Estimate remaining cost (number of unmet goal conditions)."""
        unmet = 0
        for key, value in goal_state.items():
            if state.get(key) != value:
                unmet += 1
        return unmet

    def translate_goal(self, goal_description: str) -> Dict[str, Any]:
        """
        In a real scenario, this would use an LLM to map a string to a state dict.
        For now, we use simple keyword mapping.
        """
        goal_map = {
            "trade": {"trade_complete": True},
            "code": {"code_verified": True},
            "research": {"has_analysis": True},
            "report": {"report_ready": True},
            "mockup": {"has_ui_mockup": True},
            "ui": {"has_ui_mockup": True}
        }
        
        target_state = {}
        desc = goal_description.lower()
        for key, state in goal_map.items():
            if key in desc:
                target_state.update(state)
        
        if not target_state:
            target_state = {"has_analysis": True} # Default fallback
            
        return target_state

if __name__ == "__main__":
    planner = GOAPPlanner()
    goal = planner.translate_goal("I want to trade profitably and have a report ready")
    print(f"Goal State: {goal}")
    
    plan = planner.plan({}, goal)
    if plan:
        print("Plan found:")
        for i, action in enumerate(plan):
            print(f"  {i+1}. [{action.specialist}] {action.name}")
    else:
        print("No plan possible.")
