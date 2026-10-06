"""
Telemetry and Agent Tracing using Sentry SDK.
Instruments multi-step agent pipelines (TabPFN predictor -> Gemma advisory -> ElevenLabs audio).
Logs latency, token estimates, and performance spans for judging write-ups.
"""

import os
import time
import sentry_sdk
from typing import Dict, Any, List
from contextlib import contextmanager

SENTRY_DSN = os.getenv("SENTRY_DSN", "")

# Initialize Sentry if DSN is supplied
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
        environment=os.getenv("ENVIRONMENT", "development"),
        release="canopycast@1.0.0"
    )

class AgentTelemetryRecorder:
    def __init__(self):
        self.traces: List[Dict[str, Any]] = []

    @contextmanager
    def record_span(self, op: str, description: str, metadata: Dict[str, Any] = None):
        start_time = time.time()
        span_data = {
            "op": op,
            "description": description,
            "start_time": start_time,
            "metadata": metadata or {}
        }
        
        # Sentry official trace span
        sentry_span = None
        if SENTRY_DSN:
            try:
                sentry_span = sentry_sdk.start_span(op=op, description=description)
                sentry_span.__enter__()
            except Exception:
                pass
                
        try:
            yield span_data
        except Exception as e:
            span_data["error"] = str(e)
            if sentry_span:
                try:
                    sentry_sdk.capture_exception(e)
                except Exception:
                    pass
            raise e
        finally:
            end_time = time.time()
            duration_ms = round((end_time - start_time) * 1000, 2)
            span_data["end_time"] = end_time
            span_data["duration_ms"] = duration_ms
            self.traces.append(span_data)
            
            if sentry_span:
                try:
                    sentry_span.__exit__(None, None, None)
                except Exception:
                    pass

    def get_latest_traces(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self.traces[-limit:]

    def clear(self):
        self.traces.clear()

telemetry_recorder = AgentTelemetryRecorder()
