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
          // Altitude not exposed by hardware, log coordinates
          alert(`GPS Coordinates locked: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}. Device altitude sensor unavailable; elevation slider adjusted.`);
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
  btnPlayAudio.addEventListener("click", () => {
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
  });

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

  function runDispatch() {
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
