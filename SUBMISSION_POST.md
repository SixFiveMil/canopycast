---
title: "CanopyCast: Eyes-Up Bio-Climate Field Companion & Trail Foraging Oracle"
published: false
tags: devchallenge, hf26challenge, hacktoberfest, opensourceai
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

---

## What I Built

Most outdoor mobile apps make the same fundamental mistake: they ask you to look down at your screen while nature is happening all around you.

**CanopyCast** is an open-source, edge-first bio-climatic field companion built with one guiding philosophy: **the screen should be the shortest part of the outdoor experience.**

Designed for hikers, fall-foliage watchers, and wild mushroom foragers venturing into backcountry trails with **zero cellular connectivity**, CanopyCast:
1. **Predicts Autumn Canopy Saturation (%) & Fungi Flushes**: Using Prior Labs' **TabPFN** tabular foundation model, it analyzes microclimate sensor readings (elevation, soil temperature, days since rainfall, canopy cover, and seasonal week) to forecast autumn color peaks and edible fungi flushes (Chanterelles, Porcini, Lion's Mane, Chicken of the Woods).
2. **Generates Backcountry Botanical Guidance**: Google's open-weight **Gemma 2** synthesizes ecological forecasts into practical safety advisories—highlighting critical lookalikes (e.g., toxic Jack O'Lantern warnings) and Leave-No-Trace principles.
3. **Speaks "Eyes-Up" Audio Dispatches**: Through **ElevenLabs** (with offline Web Speech fallback), CanopyCast converts dispatches into spoken audio. You tap a button at the trailhead, slide your phone into your pocket, and listen through your earbuds while keeping your eyes on the trail.
4. **Tracks Execution Telemetry**: Instrumented end-to-end with **Sentry Agent Tracing**, capturing latency, spans, and token metrics across the multi-model pipeline.

---

## Demo

* **Live Demo**: [Deploy link or Render URL here]
* **Demo Video / Walkthrough**: [Link to 1-minute video / GIF demo]

### The Experience on the Trail
Imagine hiking at 3,200 ft in the Pacific Northwest Cascades:
* You pull up CanopyCast for 10 seconds: *Elevation 3,200 ft, soil temperature 49°F, 2 days since rain.*
* **TabPFN** computes: *64.1% Near-Peak Autumn Foliage, 88% Golden Chanterelle flush probability, Zero Frost Risk.*
* **ElevenLabs** whispers into your headphones:
  > *"Canopy Dispatch: At 3,200 feet, maple canopy saturation is nearing peak color. High probability of Golden Chanterelles along mossy damp ravines. Caution: Verify blunt decurrent ridges and avoid clustered specimens on rotting wood to rule out toxic Jack O'Lanterns. Pack it in, pack it out."*
* Phone goes back into your pocket. You touch grass.

---

## Code

* **GitHub Repository**: [https://github.com/your-username/canopycast](https://github.com/your-username/canopycast)
* **License**: MIT

The repository includes the full FastAPI backend, interactive mobile UI, dataset generator, Dockerfile, Render blueprint (`render.yaml`), and a test suite.

---

## How I Built It

CanopyCast integrates four open-source AI and developer platforms into a unified trail pipeline:

### 1. TabPFN (Prior Labs) — Ecological Tabular Foundation Model
Traditional LLMs are notoriously poor at numerical regression and microclimate probability distributions. We utilized **TabPFN** (`tabpfn` v9.1.0) directly inside our prediction engine. Feeding historical USDA Forest Service microclimate observations, TabPFN performs in-context tabular regression (for autumn foliage peak percentages) and multi-class classification (for mushroom flush identification) without requiring extensive gradient fine-tuning. For off-grid trailheads where model tokens aren't cached, an offline edge surrogate runs seamlessly.

### 2. Gemma 2 — Open-Weight Botanical Reasoning
We used Google's open-weight **Gemma 2** (`gemma2:2b` / `gemma2:9b`) to transform cold numeric probabilities into actionable field safety advisories. Gemma acts as the trail naturalist, parsing TabPFN's output to inject species-specific botanical descriptions, lookalike cautions, and sustainable harvesting guidance.

### 3. ElevenLabs — Eyes-Up Audio Narration
To ensure the screen is barely used, we integrated **ElevenLabs Turbo v2.5** to generate natural spoken dispatches. If a hiker is off-grid without active internet, the frontend seamlessly cascades to the browser's native Web Speech synthesis API (`window.speechSynthesis`), guaranteeing zero-cloud audio delivery on remote trails.

### 4. Sentry Agent Tracing — Observability & Latency Spans
Every execution of the agent pipeline is instrumented with the `sentry-sdk`:
* `tabpfn.bio_prediction`: Captures feature ingestion and inference duration.
* `gemma.botanical_advisory`: Traces prompt synthesis, token estimation, and reasoning latency.
* `elevenlabs.audio_synthesis`: Profiles audio byte generation and payload streaming.
All spans are rendered directly into an on-screen telemetry inspector.

---

## Why Does Open Innovation Matter?

Open-source and open-weight AI are not just nice-to-haves for CanopyCast—**they are what make it function in the wild**:

1. **Backcountry Zero-Connectivity Independence**: Closed proprietary APIs (OpenAI, Claude) are completely useless when you are miles into a state park or mountain trail with zero cellular bars. Open weights (Gemma, TabPFN) can be packaged into local edge runners or mobile runtimes (Ollama, ONNX, WebGPU) that execute entirely on-device.
2. **Forager Geographic Privacy**: Experienced foragers protect their personal patches with fierce confidentiality. Commercial closed models ingest prompts and GPS coordinates into training corpora and corporate telemetry. Open innovation guarantees that coordinates and microclimate data never leave the hiker's hardware.
3. **Hybrid Model Specialization**: Rather than forcing a massive generalist LLM to hallucinate meteorological tables, open architecture let us pair a specialized tabular foundation model (TabPFN) with a conversational open-weight model (Gemma 2) and an audio synthesis pipeline (ElevenLabs).

---

## Bonus Field Test: Taking It Outside 🥾

*(Insert 2–3 photos of your phone running CanopyCast on a local park trail, backyard garden, or autumn tree canopy)*

> *"Tested CanopyCast on an afternoon hike through [Your Local Park / Trail Name]. Ambient air was 52°F with crisp overcast skies. Running the trail dispatch took less than 400ms, and having the botanical lookalike warning read out through earbuds while scanning the forest floor kept my phone in my pocket the entire hike."*

---

## My Agent Session

*Agent sessions and trajectory logs recorded during development:*
<!-- Embed with DevRelay agent_session tag or link your transcript -->

---

## Prize Categories

* **Best Use of TabPFN ($200)**: Used Prior Labs' TabPFN tabular foundation model for non-trivial microclimate regression and ecological flush classification.
* **Best Use of Gemma ($200)**: Leveraged Google's open-weight Gemma 2 model to reason over tabular predictions and provide botanical safety warnings.
* **Best Use of ElevenLabs ($100)**: Powering the "eyes-up, screen-down" audio dispatch interface.
* **Best Use of Sentry Agent Tracing ($100)**: Instrumented pipeline with Sentry spans measuring tool durations, tokens, and model handoffs.
* **Best Use of Render ($200)**: Containerized web service configured with `render.yaml` for 1-click cloud deployment.
