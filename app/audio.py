"""
ElevenLabs Audio Narration Engine for CanopyCast.
Enables 'eyes-up, screen-down' trail guidance for hikers and outdoor enthusiasts.
Converts bio-climatic advisory into crystal-clear speech with offline Web Speech fallback.
"""

import os
import requests
import base64
from typing import Dict, Any, Optional
from app.telemetry import telemetry_recorder

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM") # "Rachel" or default clear voice

class AudioNarrationEngine:
    def __init__(self):
        self.api_key = ELEVENLABS_API_KEY
        self.voice_id = ELEVENLABS_VOICE_ID

    def synthesize_trail_dispatch(self, text: str) -> Dict[str, Any]:
        """Synthesizes voice audio for the trail dispatch."""
        # Simplify text for natural spoken narration
        spoken_text = self._clean_for_speech(text)

        with telemetry_recorder.record_span(
            op="elevenlabs.audio_synthesis",
            description="ElevenLabs Audio Dispatch Generation",
            metadata={"has_api_key": bool(self.api_key), "text_length": len(spoken_text)}
        ) as span:
            
            if self.api_key:
                try:
                    url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
                    headers = {
                        "Accept": "audio/mpeg",
                        "Content-Type": "application/json",
                        "xi-api-key": self.api_key
                    }
                    data = {
                        "text": spoken_text,
                        "model_id": "eleven_turbo_v2_5",
                        "voice_settings": {
                            "stability": 0.5,
                            "similarity_boost": 0.75
                        }
                    }
                    resp = requests.post(url, json=data, headers=headers, timeout=10.0)
                    if resp.status_code == 200:
                        audio_b64 = base64.b64encode(resp.content).decode("utf-8")
                        audio_uri = f"data:audio/mpeg;base64,{audio_b64}"
                        span["audio_bytes"] = len(resp.content)
                        return {
                            "provider": "ElevenLabs Turbo v2.5",
                            "has_audio": True,
                            "audio_data_uri": audio_uri,
                            "spoken_text": spoken_text,
                            "use_web_speech_fallback": False
                        }
                    else:
                        print(f"ElevenLabs API returned {resp.status_code}: {resp.text}")
                except Exception as e:
                    print(f"ElevenLabs TTS exception: {e}")

            # Offline Backcountry Fallback (Web Speech API)
            return {
                "provider": "Native Offline Web Speech Engine (Hands-Free)",
                "has_audio": False,
                "audio_data_uri": None,
                "spoken_text": spoken_text,
                "use_web_speech_fallback": True
            }

    def _clean_for_speech(self, text: str) -> str:
        """Removes markdown symbols and headers for smooth, natural audio delivery."""
        import re
        clean = re.sub(r'[*_#`\[\]]', '', text)
        clean = re.sub(r'⚠️|🌲', '', clean)
        clean = ' '.join(clean.split())
        # Cap length for trail audio summary (first 400 chars)
        sentences = clean.split('. ')
        summary = '. '.join(sentences[:5])
        if not summary.endswith('.'):
            summary += '.'
        return summary

audio_engine = AudioNarrationEngine()
