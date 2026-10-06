// CanopyCast Frontend Client Engine

document.addEventListener("DOMContentLoaded", () => {
  // Slider displays
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
  let presetsData = [];

  const presetSelect = document.getElementById("presetSelect");
  const trailForm = document.getElementById("trailForm");
  const btnDispatch = document.getElementById("btnDispatch");
  const btnPlayAudio = document.getElementById("btnPlayAudio");
  const audioElement = document.getElementById("audioElement");

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

    // Trigger immediate run on preset selection
    runDispatch();
  });

  // Form submit handler
  trailForm.addEventListener("submit", (e) => {
    e.preventDefault();
    runDispatch();
  });

  // Play audio button
  btnPlayAudio.addEventListener("click", () => {
    if (currentAudioUri) {
      audioElement.src = currentAudioUri;
      audioElement.play();
      btnPlayAudio.textContent = "🔊 Playing Dispatch...";
      audioElement.onended = () => {
        btnPlayAudio.textContent = "▶ Listen Again";
      };
    } else if (currentSpokenText && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentSpokenText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      btnPlayAudio.textContent = "🔊 Speaking (Web Speech)...";
      utterance.onend = () => {
        btnPlayAudio.textContent = "▶ Listen Again";
      };
      window.speechSynthesis.speak(utterance);
    }
  });

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

    // Audio
    currentAudioUri = audio.audio_data_uri;
    currentSpokenText = audio.spoken_text;
    document.getElementById("audioProvider").textContent = audio.provider;
    btnPlayAudio.disabled = false;
    btnPlayAudio.textContent = "▶ Listen Hands-Free";

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

  function formatMarkdown(text) {
    if (!text) return "";
    let clean = escapeHtml(text);
    // Bold
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Line breaks
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
