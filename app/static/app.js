// CanopyCast Frontend Client Engine

document.addEventListener("DOMContentLoaded", () => {
  // 1. Service Worker Registration (PWA Backcountry Offline Mode)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
      .then(() => {
        const badge = document.getElementById("pwaStatusBadge");
        if (badge) badge.textContent = "✈️ Offline Cache Active";
      })
      .catch((err) => console.log("SW registration skipped:", err));
  }

  // 2. Slider displays
  const sliders = [
    { id: "elevation", valId: "elevationVal", unit: " ft", format: (v) => Number(v).toLocaleString() },
    { id: "ambientTemp", valId: "ambientTempVal", unit: " °F", format: (v) => v },
    { id: "soilTemp", valId: "soilTempVal", unit: " °F", format: (v) => Number(v).toFixed(1) },
    { id: "daysRain", valId: "daysRainVal", unit: " days", format: (v) => v },
    { id: "canopyCover", valId: "canopyCoverVal", unit: "%", format: (v) => v },
    { id: "weekOfYear", valId: "weekOfYearVal", unit: "", format: (v) => `Week ${v} (Autumn)` },
  ];

  sliders.forEach(s => {
    const el = document.getElementById(s.id);
    const disp = document.getElementById(s.valId);
    if (el && disp) {
      el.addEventListener("input", (e) => {
        disp.textContent = s.format(e.target.value) + s.unit;
      });
    }
  });

  // State
  let currentAudioUri = null;
  let currentSpokenText = "";
  let currentPhotoData = null;
  let latestDispatchData = null;
  let presetsData = [];
  let shakeModeActive = false;
  let lastShakeTime = 0;
  let shakeCount = 0;

  // DOM Elements
  const presetSelect = document.getElementById("presetSelect");
  const trailForm = document.getElementById("trailForm");
  const btnDispatch = document.getElementById("btnDispatch");
  const btnPlayAudio = document.getElementById("btnPlayAudio");
  const btnStopAudio = document.getElementById("btnStopAudio");
  const audioElement = document.getElementById("audioElement");
  const audioIcon = document.getElementById("audioIcon");
  const btnGps = document.getElementById("btnGps");
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");
  const photoPreviewContainer = document.getElementById("photoPreviewContainer");
  const photoFileName = document.getElementById("photoFileName");
  const btnRemovePhoto = document.getElementById("btnRemovePhoto");
  const advisoryActions = document.getElementById("advisoryActions");
  const btnSaveJournal = document.getElementById("btnSaveJournal");
  const journalCard = document.getElementById("journalCard");
  const journalEntries = document.getElementById("journalEntries");
  const btnExportJournal = document.getElementById("btnExportJournal");
  const btnClearJournal = document.getElementById("btnClearJournal");

  // New Feature Elements
  const toggleShakeMode = document.getElementById("toggleShakeMode");
  const shakeStatus = document.getElementById("shakeStatus");
  const lookalikePanel = document.getElementById("lookalikePanel");
  const lookalikeToggleBtn = document.getElementById("lookalikeToggleBtn");
  const lookalikeBody = document.getElementById("lookalikeBody");
  const lookalikeArrow = document.getElementById("lookalikeArrow");
  const lookalikeTargetName = document.getElementById("lookalikeTargetName");
  const lookalikeToxicName = document.getElementById("lookalikeToxicName");
  const lookalikeToxicityLevel = document.getElementById("lookalikeToxicityLevel");
  const lookalikeTableBody = document.getElementById("lookalikeTableBody");
  const secondaryLookalikeNote = document.getElementById("secondaryLookalikeNote");
  const btnSimulateRoute = document.getElementById("btnSimulateRoute");
  const waypointsTimeline = document.getElementById("waypointsTimeline");
  const btnOpenBenchmark = document.getElementById("btnOpenBenchmark");
  const btnCloseBenchmark = document.getElementById("btnCloseBenchmark");
  const benchmarkModal = document.getElementById("benchmarkModal");
  const benchmarkTableBody = document.getElementById("benchmarkTableBody");
  const btnPrintCard = document.getElementById("btnPrintCard");

  // GPX DOM Elements
  const gpxDropZone = document.getElementById("gpxDropZone");
  const gpxFileInput = document.getElementById("gpxFileInput");
  const gpxSelectedName = document.getElementById("gpxSelectedName");
  const gpxResultsPanel = document.getElementById("gpxResultsPanel");
  const gpxTrailName = document.getElementById("gpxTrailName");
  const gpxDistance = document.getElementById("gpxDistance");
  const gpxGain = document.getElementById("gpxGain");
  const gpxFlushesCount = document.getElementById("gpxFlushesCount");
  const gpxElevationSvg = document.getElementById("gpxElevationSvg");
  const btnExportEnrichedGpx = document.getElementById("btnExportEnrichedGpx");
  const btnSampleGpxHood = document.getElementById("btnSampleGpxHood");
  const btnSampleGpxBlueRidge = document.getElementById("btnSampleGpxBlueRidge");
  let latestGpxAnalysis = null;


  // Load presets
  fetch("/api/presets")
    .then(r => r.json())
    .then(presets => {
      presetsData = presets;
      presets.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        presetSelect.appendChild(opt);
      });
    })
    .catch(err => console.error("Error loading presets:", err));

  // Preset Selection Handler
  presetSelect.addEventListener("change", (e) => {
    const selected = presetsData.find(p => p.id === e.target.value);
    if (!selected) return;

    document.getElementById("elevation").value = selected.elevation_ft;
    document.getElementById("elevationVal").textContent = Number(selected.elevation_ft).toLocaleString() + " ft";

    document.getElementById("ambientTemp").value = selected.ambient_temp_f;
    document.getElementById("ambientTempVal").textContent = selected.ambient_temp_f + " °F";

    document.getElementById("soilTemp").value = selected.soil_temp_f;
    document.getElementById("soilTempVal").textContent = selected.soil_temp_f.toFixed(1) + " °F";

    document.getElementById("daysRain").value = selected.days_since_rain;
    document.getElementById("daysRainVal").textContent = selected.days_since_rain + " days";

    document.getElementById("canopyCover").value = selected.canopy_cover_pct;
    document.getElementById("canopyCoverVal").textContent = selected.canopy_cover_pct + "%";

    document.getElementById("weekOfYear").value = selected.week_of_year;
    document.getElementById("weekOfYearVal").textContent = `Week ${selected.week_of_year} (Autumn)`;

    document.getElementById("hikerNotes").value = selected.notes || "";

    runDispatch();
  });

  // GPS Auto-Detect Feature
  btnGps.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      alert("GPS Geolocation not supported on this device/browser.");
      return;
    }
    btnGps.textContent = "📍 Detecting...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        btnGps.textContent = "📍 GPS Detect";
        const altMeters = pos.coords.altitude;
        if (altMeters !== null && !isNaN(altMeters)) {
          const altFeet = Math.round(altMeters * 3.28084);
          const clamped = Math.max(500, Math.min(10000, altFeet));
          document.getElementById("elevation").value = clamped;
          document.getElementById("elevationVal").textContent = Number(clamped).toLocaleString() + " ft";
          alert(`GPS Altitude locked: ${Number(clamped).toLocaleString()} ft (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        } else {
          alert(`GPS Coordinates locked: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}. Elevation calibrated.`);
        }
      },
      (err) => {
        btnGps.textContent = "📍 GPS Detect";
        alert("GPS Signal unavailable or permission denied: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  // Photo Attachment Handler
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    photoFileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentPhotoData = ev.target.result;
      photoPreview.src = currentPhotoData;
      photoPreviewContainer.style.display = "flex";
    };
    reader.readAsDataURL(file);
  });

  btnRemovePhoto.addEventListener("click", () => {
    currentPhotoData = null;
    photoInput.value = "";
    photoFileName.textContent = "No photo attached";
    photoPreviewContainer.style.display = "none";
  });

  // Form submit handler
  trailForm.addEventListener("submit", (e) => {
    e.preventDefault();
    runDispatch();
  });

  // Audio Playback Handlers
  btnPlayAudio.addEventListener("click", playAudioDispatch);

  function playAudioDispatch() {
    if (currentAudioUri) {
      audioElement.src = currentAudioUri;
      audioElement.play();
      btnPlayAudio.textContent = "🔊 Playing Dispatch...";
      btnStopAudio.style.display = "inline-flex";
      audioIcon.classList.add("speaking");

      audioElement.onended = () => {
        resetAudioUi();
      };
    } else if (currentSpokenText && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentSpokenText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      btnPlayAudio.textContent = "🔊 Speaking (Web Speech)...";
      btnStopAudio.style.display = "inline-flex";
      audioIcon.classList.add("speaking");

      utterance.onend = () => {
        resetAudioUi();
      };
      window.speechSynthesis.speak(utterance);
    }
  }

  btnStopAudio.addEventListener("click", () => {
    if (currentAudioUri) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    resetAudioUi();
  });

  function resetAudioUi() {
    btnPlayAudio.textContent = "▶ Listen Again";
    btnStopAudio.style.display = "none";
    audioIcon.classList.remove("speaking");
  }

  // Feature 1: Pocket Shake Audio Gesture Handler
  toggleShakeMode.addEventListener("change", (e) => {
    shakeModeActive = e.target.checked;
    if (shakeModeActive) {
      shakeStatus.textContent = "🟢 Listening for pocket shake...";
      shakeStatus.style.color = "var(--primary-green)";
      window.addEventListener("devicemotion", handleDeviceMotion);
      // Play a quick auditory confirmation chime
      playTone(520, 0.15);
    } else {
      shakeStatus.textContent = "Gesture inactive";
      shakeStatus.style.color = "var(--text-muted)";
      window.removeEventListener("devicemotion", handleDeviceMotion);
    }
  });

  function handleDeviceMotion(e) {
    if (!shakeModeActive) return;
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;

    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const now = Date.now();

    if (mag > 22.0) { // Threshold for vigorous shake
      if (now - lastShakeTime > 400 && now - lastShakeTime < 1800) {
        shakeCount++;
        if (shakeCount >= 2) {
          // Double shake detected in pocket!
          shakeCount = 0;
          lastShakeTime = 0;
          playTone(660, 0.2); // Notification chime
          shakeStatus.textContent = "⚡ Pocket shake triggered!";
          setTimeout(() => {
            shakeStatus.textContent = "🟢 Listening for pocket shake...";
          }, 3000);

          // Run dispatch and speak immediately
          runDispatch(true);
        }
      } else {
        shakeCount = 1;
        lastShakeTime = now;
      }
    }
  }

  function playTone(freq, dur) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.stop(ctx.currentTime + dur);
    } catch {
      // AudioContext not supported
    }
  }

  function runDispatch(autoPlayAudio = false) {
    btnDispatch.disabled = true;
    btnDispatch.innerHTML = `<span class="btn-icon">⏳</span> Analyzing Microclimate...`;

    const payload = {
      elevation_ft: parseFloat(document.getElementById("elevation").value),
      ambient_temp_f: parseFloat(document.getElementById("ambientTemp").value),
      soil_temp_f: parseFloat(document.getElementById("soilTemp").value),
      days_since_rain: parseFloat(document.getElementById("daysRain").value),
      canopy_cover_pct: parseFloat(document.getElementById("canopyCover").value),
      week_of_year: parseInt(document.getElementById("weekOfYear").value),
      slope_degrees: 15.0,
      hiker_notes: document.getElementById("hikerNotes").value
    };

    fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      latestDispatchData = data;
      renderResults(data);
      if (autoPlayAudio) {
        setTimeout(playAudioDispatch, 300);
      }
    })
    .catch(err => {
      console.error("Dispatch error:", err);
      alert("Error generating trail dispatch. Check console.");
    })
    .finally(() => {
      btnDispatch.disabled = false;
      btnDispatch.innerHTML = `<span class="btn-icon">⚡</span> Run Agent Pipeline & Synthesize Audio`;
    });
  }

  function renderResults(data) {
    const pred = data.prediction;
    const adv = data.advisory;
    const audio = data.audio;
    const tel = data.telemetry;
    const lookalike = data.lookalike;

    // Engine labels
    document.getElementById("engineTypeLabel").textContent = pred.engine;
    if (pred.is_native_tabpfn) {
      document.getElementById("engineStatusBadge").textContent = "● Native TabPFN";
      document.getElementById("engineStatusBadge").className = "pill pill-green";
    } else {
      document.getElementById("engineStatusBadge").textContent = "● TabPFN Edge Mode";
      document.getElementById("engineStatusBadge").className = "pill pill-green";
    }

    // Foliage
    document.getElementById("foliagePct").textContent = pred.foliage_peak_pct + "%";
    document.getElementById("foliageProgress").style.width = pred.foliage_peak_pct + "%";
    document.getElementById("foliageStage").textContent = pred.foliage_stage;

    // Fungi Flush
    document.getElementById("fungiSpecies").textContent = pred.fungi_flush_species;
    document.getElementById("fungiConfidence").textContent = pred.fungi_confidence_pct + "%";
    document.getElementById("botanicalName").textContent = adv.species_botanical_name || "Biological verification";

    // Frost
    document.getElementById("frostRisk").textContent = pred.frost_risk;

    // Advisory
    document.getElementById("advisorModelBadge").textContent = adv.model;
    document.getElementById("advisoryContent").innerHTML = formatMarkdown(adv.advisory_markdown);
    advisoryActions.style.display = "flex";

    // Feature 3: Render Lookalike Diagnostic Card
    if (lookalike && pred.fungi_flush_species !== "No Flush Detected") {
      lookalikePanel.style.display = "block";
      lookalikeTargetName.textContent = lookalike.target_species;
      lookalikeToxicName.textContent = lookalike.toxic_lookalike;
      lookalikeToxicityLevel.textContent = "Warning Level: " + lookalike.toxicity_level;

      lookalikeTableBody.innerHTML = "";
      if (lookalike.diagnostic_traits) {
        lookalike.diagnostic_traits.forEach(t => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${escapeHtml(t.feature)}</strong></td>
            <td class="col-safe">✓ ${escapeHtml(t.target)}</td>
            <td class="col-danger">⚠️ ${escapeHtml(t.toxic)}</td>
          `;
          lookalikeTableBody.appendChild(tr);
        });
      }
      secondaryLookalikeNote.textContent = lookalike.secondary_lookalike || "";
    } else {
      lookalikePanel.style.display = "none";
    }

    // Audio
    currentAudioUri = audio.audio_data_uri;
    currentSpokenText = audio.spoken_text;
    document.getElementById("audioProvider").textContent = audio.provider;
    btnPlayAudio.disabled = false;
    btnPlayAudio.textContent = "▶ Listen Hands-Free";
    btnStopAudio.style.display = "none";
    audioIcon.classList.remove("speaking");

    // Telemetry Table
    document.getElementById("totalLatency").textContent = (tel.total_latency_ms || 0) + " ms";
    const tbody = document.getElementById("traceTableBody");
    tbody.innerHTML = "";

    if (tel.traces && tel.traces.length > 0) {
      tel.traces.forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="span-tag">${escapeHtml(t.op)}</span></td>
          <td>${escapeHtml(t.description)}</td>
          <td><span class="duration-tag">${t.duration_ms} ms</span></td>
          <td><code>${escapeHtml(JSON.stringify(t.metadata || {}))}</code></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // Lookalike Accordion Toggle
  lookalikeToggleBtn.addEventListener("click", () => {
    if (lookalikeBody.style.display === "none") {
      lookalikeBody.style.display = "flex";
      lookalikeArrow.textContent = "▲ Close Checklist";
    } else {
      lookalikeBody.style.display = "none";
      lookalikeArrow.textContent = "▼ Details";
    }
  });

  // Feature: GPX Trail Track Analyzer Handlers
  gpxDropZone.addEventListener("click", () => gpxFileInput.click());

  gpxDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    gpxDropZone.classList.add("dragover");
  });

  gpxDropZone.addEventListener("dragleave", () => {
    gpxDropZone.classList.remove("dragover");
  });

  gpxDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    gpxDropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleGpxFile(file);
  });

  gpxFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleGpxFile(file);
  });

  function handleGpxFile(file) {
    gpxSelectedName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      runGpxAnalysis(ev.target.result);
    };
    reader.readAsText(file);
  }

  // Sample GPX Trail Buttons
  let sampleGpxMap = {};
  fetch("/api/gpx/samples")
    .then(r => r.json())
    .then(samples => {
      samples.forEach(s => { sampleGpxMap[s.id] = s; });
    })
    .catch(err => console.error("Error loading sample GPX trails:", err));

  btnSampleGpxHood.addEventListener("click", () => {
    if (sampleGpxMap["mt_hood_mirror_lake"]) {
      gpxSelectedName.textContent = sampleGpxMap["mt_hood_mirror_lake"].name;
      runGpxAnalysis(sampleGpxMap["mt_hood_mirror_lake"].gpx_xml);
    }
  });

  btnSampleGpxBlueRidge.addEventListener("click", () => {
    if (sampleGpxMap["blue_ridge_craggy"]) {
      gpxSelectedName.textContent = sampleGpxMap["blue_ridge_craggy"].name;
      runGpxAnalysis(sampleGpxMap["blue_ridge_craggy"].gpx_xml);
    }
  });

  function runGpxAnalysis(xmlString) {
    gpxSelectedName.textContent += " (Analyzing TabPFN Bio-Climate...)";
    fetch("/api/gpx/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gpx_xml: xmlString,
        base_ambient_temp_f: parseFloat(document.getElementById("ambientTemp").value),
        base_soil_temp_f: parseFloat(document.getElementById("soilTemp").value),
        days_since_rain: parseFloat(document.getElementById("daysRain").value),
        week_of_year: parseInt(document.getElementById("weekOfYear").value)
      })
    })
    .then(r => {
      if (!r.ok) return r.json().then(j => { throw new Error(j.detail || "GPX parse error"); });
      return r.json();
    })
    .then(data => {
      latestGpxAnalysis = data;
      renderGpxResults(data);
    })
    .catch(err => {
      alert("Error analyzing GPX track: " + err.message);
    });
  }

  function renderGpxResults(data) {
    gpxResultsPanel.style.display = "flex";
    gpxTrailName.textContent = data.trail_name;
    gpxDistance.textContent = data.summary.total_distance_miles + " mi";
    gpxGain.textContent = "+ " + Number(data.summary.elevation_gain_ft).toLocaleString() + " ft";
    gpxFlushesCount.textContent = data.summary.fungi_flushes_found + " zones";

    renderGpxSvgChart(data);
  }

  function renderGpxSvgChart(data) {
    const wpts = data.waypoints;
    if (!wpts || wpts.length < 2) return;

    const svgW = 700;
    const svgH = 180;
    const padX = 40;
    const padY = 25;

    const minEle = data.summary.min_elevation_ft;
    const maxEle = data.summary.max_elevation_ft || (minEle + 500);
    const maxDist = data.summary.total_distance_miles || 1.0;

    const scaleX = (dist) => padX + (dist / maxDist) * (svgW - padX * 2);
    const scaleY = (ele) => svgH - padY - ((ele - minEle) / Math.max(1, maxEle - minEle)) * (svgH - padY * 2);

    let pathD = `M ${scaleX(wpts[0].distance_miles)} ${scaleY(wpts[0].elevation_ft)}`;
    wpts.forEach(w => {
      pathD += ` L ${scaleX(w.distance_miles)} ${scaleY(w.elevation_ft)}`;
    });

    const fillD = pathD + ` L ${scaleX(wpts[wpts.length - 1].distance_miles)} ${svgH - padY} L ${scaleX(wpts[0].distance_miles)} ${svgH - padY} Z`;

    let svgInner = `
      <defs>
        <linearGradient id="elevFillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2ecc71" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#2ecc71" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <!-- Base Axis -->
      <line x1="${padX}" y1="${svgH - padY}" x2="${svgW - padX}" y2="${svgH - padY}" stroke="#213325" stroke-width="1"/>
      <path d="${fillD}" fill="url(#elevFillGrad)" />
      <path d="${pathD}" fill="none" stroke="#2ecc71" stroke-width="2.5" />
    `;

    // Render Waypoint Markers & Fungi Icons
    wpts.forEach(w => {
      const cx = scaleX(w.distance_miles);
      const cy = scaleY(w.elevation_ft);
      const isPeak = (data.summary.peak_foliage_point && w.distance_miles === data.summary.peak_foliage_point.mile);

      // Node point
      svgInner += `<circle cx="${cx}" cy="${cy}" r="4" fill="${isPeak ? '#f39c12' : '#2ecc71'}" stroke="#060a07" stroke-width="1.5"/>`;

      // Fungi flush marker
      if (w.fungi_species !== "No Flush Detected") {
        svgInner += `
          <g transform="translate(${cx - 10}, ${cy - 26})">
            <text font-size="14">🍄</text>
            <title>${escapeHtml(w.fungi_species)} (${w.fungi_confidence_pct}%) at ${w.elevation_ft} ft</title>
          </g>
        `;
      }

      // Peak foliage banner
      if (isPeak) {
        svgInner += `
          <g transform="translate(${cx - 10}, ${cy - 28})">
            <text font-size="14">🍁</text>
            <title>Peak Foliage: ${w.foliage_peak_pct}% at Mile ${w.distance_miles}</title>
          </g>
        `;
      }
    });

    // Axis labels
    svgInner += `
      <text x="${padX}" y="${svgH - 6}" font-size="10" fill="#8fa593">0 mi (${minEle.toLocaleString()} ft)</text>
      <text x="${svgW - padX}" y="${svgH - 6}" font-size="10" fill="#8fa593" text-anchor="end">${maxDist} mi (${maxEle.toLocaleString()} ft)</text>
    `;

    gpxElevationSvg.innerHTML = svgInner;
  }

  // Export Enriched GPX
  btnExportEnrichedGpx.addEventListener("click", () => {
    if (!latestGpxAnalysis) return;
    fetch("/api/gpx/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(latestGpxAnalysis)
    })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canopycast_${latestGpxAnalysis.trail_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_enriched.gpx`;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(err => alert("Error exporting GPX: " + err));
  });

  // Feature 2: Route Elevation & Foliage Simulator

  btnSimulateRoute.addEventListener("click", () => {
    btnSimulateRoute.disabled = true;
    btnSimulateRoute.textContent = "Simulating Route...";

    const currentElev = parseFloat(document.getElementById("elevation").value);
    const trailhead = Math.max(800, currentElev - 1500);
    const summit = currentElev + 1200;

    fetch("/api/route-simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trailhead_elev_ft: trailhead,
        summit_elev_ft: summit,
        total_distance_miles: 4.0,
        base_temp_f: parseFloat(document.getElementById("ambientTemp").value) + 5.0,
        base_soil_temp_f: parseFloat(document.getElementById("soilTemp").value) + 3.0,
        days_since_rain: parseFloat(document.getElementById("daysRain").value),
        week_of_year: parseInt(document.getElementById("weekOfYear").value),
        num_waypoints: 6
      })
    })
    .then(r => r.json())
    .then(data => {
      renderRouteSimulation(data);
    })
    .catch(err => console.error("Route simulation error:", err))
    .finally(() => {
      btnSimulateRoute.disabled = false;
      btnSimulateRoute.textContent = "🔄 Re-Simulate Climb";
    });
  });

  function renderRouteSimulation(data) {
    waypointsTimeline.innerHTML = "";
    const waypoints = data.waypoints;

    waypoints.forEach((wp, idx) => {
      const card = document.createElement("div");
      card.className = "waypoint-card" + (wp.foliage_peak_pct >= 70 ? " peak-foliage" : "");
      card.innerHTML = `
        <div class="waypoint-mile">Mile ${wp.distance_miles}</div>
        <div class="waypoint-elev">▲ ${wp.elevation_ft.toLocaleString()} ft (${wp.ambient_temp_f}°F)</div>
        <div class="waypoint-foliage">🍁 ${wp.foliage_peak_pct}% Foliage</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(wp.foliage_stage)}</div>
        ${wp.fungi_species !== "No Flush Detected" ? `<div style="font-size:0.75rem; color:var(--primary-green); margin-top:0.25rem;">🍄 ${escapeHtml(wp.fungi_species)}</div>` : ''}
      `;
      waypointsTimeline.appendChild(card);
    });
  }

  // Feature 4: Model Science Benchmark Modal
  btnOpenBenchmark.addEventListener("click", () => {
    benchmarkModal.style.display = "flex";
    fetch("/api/benchmark")
      .then(r => r.json())
      .then(data => {
        benchmarkTableBody.innerHTML = "";
        data.models.forEach(m => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${escapeHtml(m.model)}</strong></td>
            <td><span class="badge-mini">${escapeHtml(m.type)}</span></td>
            <td><strong style="color:var(--primary-green);">${m.accuracy_pct}%</strong></td>
            <td>${m.macro_f1_pct}%</td>
            <td>${m.train_latency_ms} ms</td>
            <td>${m.inference_latency_ms} ms</td>
            <td><small>${escapeHtml(m.highlights)}</small></td>
          `;
          benchmarkTableBody.appendChild(tr);
        });
      })
      .catch(err => {
        benchmarkTableBody.innerHTML = `<tr><td colspan="7">Error loading benchmark data.</td></tr>`;
      });
  });

  btnCloseBenchmark.addEventListener("click", () => {
    benchmarkModal.style.display = "none";
  });

  // Feature 5: Print Pocket Field Card
  btnPrintCard.addEventListener("click", () => {
    if (!latestDispatchData) {
      alert("Please run a trail dispatch first before printing.");
      return;
    }
    const pred = latestDispatchData.prediction;
    const lookalike = latestDispatchData.lookalike;

    document.getElementById("printDate").textContent = "Date: " + new Date().toLocaleDateString();
    document.getElementById("printElevation").textContent = pred.inputs.elevation_ft.toLocaleString() + " ft";
    document.getElementById("printFoliage").textContent = pred.foliage_peak_pct + "% (" + pred.foliage_stage + ")";
    document.getElementById("printFrost").textContent = pred.frost_risk;
    document.getElementById("printSpecies").textContent = pred.fungi_flush_species;
    document.getElementById("printConfidence").textContent = pred.fungi_confidence_pct + "%";
    document.getElementById("printLookalike").textContent = lookalike ? (lookalike.toxic_lookalike || "None") : "N/A";

    window.print();
  });

  // 3. Trail Journal Persistence & Markdown Exporter
  btnSaveJournal.addEventListener("click", () => {
    if (!latestDispatchData) return;
    const journal = getJournalEntries();
    const entry = {
      id: "entry_" + Date.now(),
      timestamp: new Date().toLocaleString(),
      elevation: latestDispatchData.prediction.inputs.elevation_ft,
      foliagePct: latestDispatchData.prediction.foliage_peak_pct,
      foliageStage: latestDispatchData.prediction.foliage_stage,
      species: latestDispatchData.prediction.fungi_flush_species,
      confidence: latestDispatchData.prediction.fungi_confidence_pct,
      frost: latestDispatchData.prediction.frost_risk,
      notes: document.getElementById("hikerNotes").value,
      photo: currentPhotoData
    };
    journal.unshift(entry);
    localStorage.setItem("canopycast_journal", JSON.stringify(journal));
    renderJournal();
    alert("Saved observation to Hiker's Field Journal!");
  });

  function getJournalEntries() {
    try {
      return JSON.parse(localStorage.getItem("canopycast_journal") || "[]");
    } catch {
      return [];
    }
  }

  function renderJournal() {
    const entries = getJournalEntries();
    if (entries.length === 0) {
      journalCard.style.display = "none";
      return;
    }
    journalCard.style.display = "flex";
    journalEntries.innerHTML = "";

    entries.forEach(item => {
      const card = document.createElement("div");
      card.className = "journal-entry";
      card.innerHTML = `
        <div class="journal-entry-header">
          <strong>${escapeHtml(item.timestamp)}</strong>
          <span>${item.elevation} ft</span>
        </div>
        <div>
          🍁 <strong>${item.foliagePct}%</strong> (${escapeHtml(item.foliageStage)})<br>
          🍄 <strong>${escapeHtml(item.species)}</strong> (${item.confidence}%)
        </div>
        ${item.notes ? `<div><em>"${escapeHtml(item.notes)}"</em></div>` : ''}
        ${item.photo ? `<img src="${item.photo}" class="journal-entry-photo" alt="Field Snap">` : ''}
      `;
      journalEntries.appendChild(card);
    });
  }

  btnExportJournal.addEventListener("click", () => {
    const entries = getJournalEntries();
    if (entries.length === 0) {
      alert("No journal entries to export.");
      return;
    }
    let md = "# 🌲 CanopyCast Field Trail Journal\n\n";
    md += `*Generated on ${new Date().toLocaleString()}*\n\n---\n\n`;

    entries.forEach((e, idx) => {
      md += `### Observation #${entries.length - idx} — ${e.timestamp}\n`;
      md += `- **Elevation**: ${e.elevation} ft\n`;
      md += `- **Autumn Foliage**: ${e.foliagePct}% (${e.foliageStage})\n`;
      md += `- **Fungi Flush**: ${e.species} (Confidence: ${e.confidence}%)\n`;
      md += `- **Frost Risk**: ${e.frost}\n`;
      if (e.notes) md += `- **Field Notes**: ${e.notes}\n`;
      md += `\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canopycast_trail_journal_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnClearJournal.addEventListener("click", () => {
    if (confirm("Clear all field journal entries?")) {
      localStorage.removeItem("canopycast_journal");
      renderJournal();
    }
  });

  // Render any existing journal on startup
  renderJournal();

  function formatMarkdown(text) {
    if (!text) return "";
    let clean = escapeHtml(text);
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    clean = clean.replace(/\n\n/g, '<br><br>');
    clean = clean.replace(/\n/g, '<br>');
    return clean;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Trigger initial preset run on load
  setTimeout(() => {
    if (presetSelect.options.length > 1) {
      presetSelect.selectedIndex = 1;
      presetSelect.dispatchEvent(new Event("change"));
    }
  }, 400);
});
