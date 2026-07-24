"""
Sovereign Goal Engine — ZAIRE
Tracks long-term targets daily. Adjusts schedule if behind, celebrates if ahead.
"""

import json
from datetime import datetime, date
from typing import Dict, Any, List

class GoalEngine:
    def __init__(self):
        # In a real environment, this would load from a database or JSON file.
        self.goals = [
            {
                "id": "g1",
                "title": "Graduate with distinction by June 2026",
                "deadline": "2026-06-01",
                "status": "on_track",
                "progress_percent": 65,
                "daily_action": "Study for 2 hours",
                "streak": 14
            },
            {
                "id": "g2",
                "title": "Learn to trade profitably by April 2026",
                "deadline": "2026-04-01",
                "status": "behind",
                "progress_percent": 30,
                "daily_action": "Backtest strategy for 30 mins",
                "streak": 2
            }
        ]

    def add_goal(self, title: str, deadline: str, daily_action: str):
        self.goals.append({
            "id": f"g{len(self.goals)+1}",
            "title": title,
            "deadline": deadline,
            "status": "on_track",
            "progress_percent": 0,
            "daily_action": daily_action,
            "streak": 0
        })

    def evaluate_daily_progress(self):
        """
        Runs a daily check on goals. If behind, injects a schedule adjustment.
        """
        adjustments = []
        for goal in self.goals:
            if goal["status"] == "behind":
                adjustments.append(
                    f"Warning: You are behind on '{goal['title']}'. Adding '{goal['daily_action']}' to today's priority queue."
                )
            elif goal["status"] == "ahead":
                adjustments.append(
                    f"Excellent: You are ahead on '{goal['title']}'. Maintaining current pacing."
                )
        return adjustments

    def get_weekly_summary(self) -> Dict[str, Any]:
        """Provides summary metrics for the Weekly Intelligence Briefing."""
        on_track = sum(1 for g in self.goals if g["status"] in ["on_track", "ahead"])
        behind = sum(1 for g in self.goals if g["status"] == "behind")
        
        return {
            "total_goals": len(self.goals),
            "goals_on_track": on_track,
            "goals_behind": behind,
            "top_priority_focus": next((g["title"] for g in self.goals if g["status"] == "behind"), "All systems nominal.")
        }

if __name__ == "__main__":
    engine = GoalEngine()
    print("Evaluating Daily Goals...")
    for adj in engine.evaluate_daily_progress():
        print(" >", adj)
