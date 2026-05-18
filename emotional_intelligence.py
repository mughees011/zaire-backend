"""
Emotional Intelligence Layer — ZAIRE Sovereign Intelligence

Analyzes voice tone to adapt ZAIRE's conversational behavior in real-time.
- Stressed: shorter answers, offers a break.
- Tired: lower speaking speed (via TTS), suggests rest.
- Excited: matches energy, goes deeper into the topic.
- Frustrated: extra calm, offers to simplify.
- Calm: default behavior.
"""

import os
import random

class EmotionalIntelligenceLayer:
    def __init__(self):
        # In a production environment, this would use librosa or a wav2vec emotion model.
        self.supported_emotions = ["STRESSED", "TIRED", "EXCITED", "FRUSTRATED", "CALM"]
    
    def analyze_audio(self, filepath: str) -> str:
        """
        Mock implementation of tone analysis from an audio file.
        In reality, it would process MFCCs or use a pre-trained neural network on the .wav file.
        """
        if not os.path.exists(filepath):
            return "CALM"
            
        # For demonstration purposes, we randomly simulate an emotion or default to CALM.
        # A real implementation would parse the acoustic features here.
        # simulated_emotion = random.choice(self.supported_emotions)
        simulated_emotion = "CALM" # Defaulting to CALM to not disrupt normal testing, can be overridden
        return simulated_emotion

    def get_prompt_modifier(self, emotion: str) -> str:
        """
        Returns a system prompt injection to fundamentally alter how ZAIRE constructs its response.
        """
        emotion = emotion.upper()
        if emotion == "STRESSED":
            return "[SYSTEM OVERRIDE: User tone indicates STRESS. Keep answers extremely short and concise. Offer to pause the current task or take a break.]"
        elif emotion == "TIRED":
            return "[SYSTEM OVERRIDE: User tone indicates FATIGUE. Speak softly, use simple sentences, and gently suggest resting or deferring complex topics until tomorrow.]"
        elif emotion == "EXCITED":
            return "[SYSTEM OVERRIDE: User tone indicates EXCITEMENT. Match their energy! Be enthusiastic, dive deeper into the topic, and use a highly motivated, visionary tone.]"
        elif emotion == "FRUSTRATED":
            return "[SYSTEM OVERRIDE: User tone indicates FRUSTRATION. Be exceptionally calm, patient, and apologetic. Offer to simplify the explanation or approach the problem from a different, easier angle.]"
        else:
            return "[SYSTEM OVERRIDE: User tone is CALM. Proceed with standard Stark-grade sovereign intelligence protocol.]"

    def get_tts_speed_modifier(self, emotion: str) -> int:
        """
        Returns a TTS speaking rate modifier.
        Base rate is usually ~150-170.
        """
        emotion = emotion.upper()
        if emotion == "TIRED":
            return 120  # slower
        elif emotion == "EXCITED":
            return 190  # faster
        elif emotion == "FRUSTRATED":
            return 140  # slightly slower and clearer
        return 160 # default
