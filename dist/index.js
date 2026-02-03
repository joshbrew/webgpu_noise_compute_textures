(()=>{var ye=`<!-- tools/noise/noiseComponent.html -->\r
<div id="noise-app">\r
  <style>\r
    :root {\r
      background-color: #000;\r
      color-scheme: dark;\r
\r
      --gap: 16px;\r
      --gap-sm: 10px;\r
\r
      --accent: #3fa9ff;\r
      --accent-soft: rgba(63, 169, 255, 0.2);\r
\r
      --panel-bg: #050505;\r
      --panel-bg2: #111;\r
\r
      --sidebar-w: 340px; /* fixed sidebar width */\r
      --canvas-min: 520px; /* min size for square canvas area */\r
      --content-max: 1200px;\r
\r
      --radius: 10px;\r
      --border: #202020;\r
    }\r
\r
    * {\r
      box-sizing: border-box;\r
    }\r
\r
    html,\r
    body {\r
      height: 100%;\r
      margin: 0;\r
      background: #000;\r
      color: #fff;\r
      overflow-x: auto; /* allow collapse via horizontal scroll, not squish */\r
      overflow-y: hidden;\r
      font-family:\r
        system-ui,\r
        -apple-system,\r
        BlinkMacSystemFont,\r
        "Segoe UI",\r
        sans-serif;\r
      min-width: calc(var(--sidebar-w) + var(--canvas-min) + (var(--gap) * 3));\r
    }\r
\r
    #noise-app {\r
      height: 100dvh;\r
      width: 100dvw;\r
      display: flex;\r
      gap: var(--gap);\r
      padding: var(--gap);\r
      overflow: hidden;\r
      background: #000;\r
      min-width: calc(var(--sidebar-w) + var(--canvas-min) + (var(--gap) * 3));\r
    }\r
\r
    /* Sidebar */\r
    aside#sidebar {\r
      flex: 0 0 var(--sidebar-w);\r
      width: var(--sidebar-w);\r
      min-width: var(--sidebar-w);\r
      max-width: var(--sidebar-w);\r
\r
      height: 100%;\r
      overflow: auto;\r
      padding: 10px 20px 20px 00px; /* extra right padding prevents focus glow clip */\r
      scrollbar-gutter: stable both-edges;\r
\r
      background: radial-gradient(\r
        circle at top,\r
        #181818 0,\r
        #050505 40%,\r
        #000 100%\r
      );\r
      border-right: 1px solid #181818;\r
\r
      font-size: 14px;\r
      z-index: 10;\r
    }\r
\r
    .sidebar-header {\r
      display: flex;\r
      flex-direction: column;\r
      gap: 2px;\r
      margin-bottom: 10px;\r
      padding: 6px 4px 8px 4px;\r
      border-bottom: 1px solid #202020;\r
    }\r
\r
    .sidebar-title {\r
      font-size: 14px;\r
      font-weight: 600;\r
      letter-spacing: 0.06em;\r
      text-transform: uppercase;\r
      color: #f5f5f5;\r
    }\r
\r
    .sidebar-subtitle {\r
      font-size: 11px;\r
      color: #aaaaaa;\r
    }\r
\r
    .sidebar-nav {\r
      display: flex;\r
      flex-wrap: wrap;\r
      gap: 6px;\r
      margin: 4px 0 10px 0;\r
    }\r
\r
    .nav-pill {\r
      padding: 4px 8px;\r
      border-radius: 999px;\r
      border: 1px solid #2b2b2b;\r
      background: rgba(20, 20, 20, 0.95);\r
      color: #d0d0d0;\r
      font-size: 11px;\r
      text-decoration: none;\r
      cursor: pointer;\r
      transition:\r
        background 0.15s ease,\r
        border-color 0.15s ease,\r
        color 0.15s ease;\r
    }\r
\r
    .nav-pill:hover {\r
      border-color: var(--accent);\r
      background: rgba(21, 80, 130, 0.9);\r
      color: #ffffff;\r
    }\r
\r
    /* Main area (no stretching; square stage) */\r
    main#main {\r
      flex: 1 1 auto;\r
      min-width: var(--canvas-min);\r
      height: 100%;\r
      overflow: auto;\r
      padding: 0;\r
      display: flex;\r
      flex-direction: column;\r
      gap: var(--gap);\r
      background: #000;\r
    }\r
\r
    .content {\r
      width: 100%;\r
      max-width: var(--content-max);\r
      margin: 0 auto;\r
      min-width: 0;\r
    }\r
\r
    #view-stack {\r
      display: flex;\r
      flex-direction: column;\r
      gap: 10px;\r
      padding: var(--gap);\r
      min-width: 0;\r
    }\r
\r
    .preview-header {\r
      display: flex;\r
      align-items: baseline;\r
      justify-content: space-between;\r
      gap: 10px;\r
      padding: 2px 4px 4px 4px;\r
      font-size: 13px;\r
      color: #ccc;\r
    }\r
\r
    #preview-meta {\r
      font-weight: 600;\r
      color: #f5f5f5;\r
      min-width: 0;\r
      overflow: hidden;\r
      text-overflow: ellipsis;\r
      white-space: nowrap;\r
    }\r
\r
    #preview-stats {\r
      font-variant-numeric: tabular-nums;\r
      opacity: 0.85;\r
      white-space: nowrap;\r
    }\r
\r
    .squareWrap {\r
      width: min(\r
        calc(100vw - var(--sidebar-w) - (var(--gap) * 4)),\r
        calc(100dvh - (var(--gap) * 3))\r
      );\r
      aspect-ratio: 1 / 1;\r
      min-width: var(--canvas-min);\r
      min-height: var(--canvas-min);\r
\r
      border-radius: var(--radius);\r
      border: 1px solid var(--border);\r
      background: #000;\r
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);\r
      overflow: hidden;\r
    }\r
\r
    /* Stage tabs */\r
    .stage {\r
      display: flex;\r
      flex-direction: column;\r
      gap: 10px;\r
      min-width: 0;\r
    }\r
\r
    .stage input[type="radio"] {\r
      position: absolute;\r
      opacity: 0;\r
      pointer-events: none;\r
    }\r
\r
    .stage-tabs {\r
      display: inline-flex;\r
      gap: 6px;\r
      padding: 6px;\r
      border: 1px solid #202020;\r
      border-radius: 999px;\r
      background: rgba(10, 10, 10, 0.85);\r
      width: fit-content;\r
    }\r
\r
    .stage-tab {\r
      display: inline-flex;\r
      align-items: center;\r
      justify-content: center;\r
      padding: 6px 10px;\r
      border-radius: 999px;\r
      border: 1px solid #2b2b2b;\r
      background: rgba(20, 20, 20, 0.95);\r
      color: #d0d0d0;\r
      font-size: 12px;\r
      letter-spacing: 0.06em;\r
      text-transform: uppercase;\r
      cursor: pointer;\r
      user-select: none;\r
      transition:\r
        background 0.15s ease,\r
        border-color 0.15s ease,\r
        color 0.15s ease;\r
    }\r
\r
    .stage-tab:hover {\r
      border-color: var(--accent);\r
      background: rgba(21, 80, 130, 0.9);\r
      color: #ffffff;\r
    }\r
\r
    #view-tab-preview:checked ~ .stage-tabs label[for="view-tab-preview"],\r
    #view-tab-tileset:checked ~ .stage-tabs label[for="view-tab-tileset"] {\r
      border-color: var(--accent);\r
      background: linear-gradient(135deg, #2575fc, #21c0ff);\r
      color: #000;\r
      font-weight: 700;\r
    }\r
\r
    .squareWrap.stageWrap {\r
      position: relative;\r
    }\r
\r
    .stage-panel {\r
      position: absolute;\r
      inset: 0;\r
      display: none;\r
      width: 100%;\r
      height: 100%;\r
    }\r
\r
    #view-tab-preview:checked ~ .stageWrap .stage-preview {\r
      display: block;\r
    }\r
\r
    #view-tab-tileset:checked ~ .stageWrap .stage-tileset {\r
      display: block;\r
    }\r
\r
    #noise-canvas {\r
      display: block;\r
      width: 100%;\r
      height: 100%;\r
    }\r
\r
    /* Mosaic panel now lives inside the stage square */\r
    #mosaic {\r
      width: 100%;\r
      height: 100%;\r
      display: grid;\r
      grid-template-columns: repeat(3, 1fr);\r
      grid-template-rows: repeat(3, 1fr);\r
      gap: 0;\r
      padding: 0;\r
      margin: 0;\r
      line-height: 0;\r
      font-size: 0;\r
\r
      border-radius: 0;\r
      overflow: hidden;\r
      border: 0;\r
      background: #000;\r
    }\r
\r
    #mosaic canvas {\r
      display: block;\r
      width: 100%;\r
      height: 100%;\r
      margin: 0;\r
      padding: 0;\r
      border: 0;\r
      background: #000;\r
    }\r
\r
    .stage-footer {\r
      margin-top: -2px;\r
      padding: 0 4px;\r
    }\r
\r
    .mosaic-caption {\r
      margin: 0;\r
      font-size: 11px;\r
      color: #aaaaaa;\r
      line-height: 1.35;\r
    }\r
\r
    #view-tab-preview:checked ~ .stage-footer {\r
      display: none;\r
    }\r
\r
    #view-tab-tileset:checked ~ .stage-footer {\r
      display: block;\r
    }\r
\r
    /* Export background toggles (near Save buttons) */\r
    #export-bg {\r
      margin: 2px 0 8px 0;\r
      padding: 8px 10px;\r
      border: 1px solid #262626;\r
      border-radius: 999px;\r
      background: rgba(12, 12, 12, 0.7);\r
      display: flex;\r
      align-items: center;\r
      gap: 10px;\r
      flex-wrap: wrap;\r
    }\r
\r
    #export-bg .export-bg-title {\r
      font-size: 0.78rem;\r
      letter-spacing: 0.06em;\r
      text-transform: uppercase;\r
      color: #cfcfcf;\r
      opacity: 0.9;\r
    }\r
\r
    #export-bg label {\r
      display: flex;\r
      align-items: center;\r
      gap: 6px;\r
      margin: 0;\r
      font-size: 0.82rem;\r
      color: #e0e0e0;\r
      cursor: pointer;\r
      user-select: none;\r
    }\r
\r
    #export-bg input[type="radio"] {\r
      transform: translateY(1px);\r
    }\r
\r
    /* Collapsible Param groups (details.param-group) */\r
    aside#sidebar .param-group {\r
      background: radial-gradient(\r
        circle at top left,\r
        #171717 0,\r
        var(--panel-bg) 35%,\r
        #020202 100%\r
      );\r
      border: 1px solid #262626;\r
      border-radius: 8px;\r
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.5);\r
      margin: 0 0 10px 0;\r
      padding: 0;\r
      overflow: hidden;\r
    }\r
\r
    aside#sidebar .param-group:hover {\r
      border-color: var(--accent);\r
      box-shadow:\r
        0 0 0 1px var(--accent-soft),\r
        0 6px 18px rgba(0, 0, 0, 0.7);\r
    }\r
\r
    aside#sidebar .param-group > summary {\r
      cursor: pointer;\r
      list-style: none;\r
      padding: 10px 9px;\r
      font-size: 0.75rem;\r
      letter-spacing: 0.12em;\r
      text-transform: uppercase;\r
      color: #e0e0e0;\r
      border-bottom: 1px solid #262626;\r
      user-select: none;\r
      display: flex;\r
      align-items: center;\r
      justify-content: space-between;\r
      gap: 10px;\r
    }\r
\r
    aside#sidebar .param-group > summary::-webkit-details-marker {\r
      display: none;\r
    }\r
\r
    aside#sidebar .param-group > summary::after {\r
      content: "\u25BE";\r
      font-size: 0.9rem;\r
      opacity: 0.9;\r
      transform: translateY(-1px);\r
      transition: transform 0.12s ease;\r
    }\r
\r
    aside#sidebar .param-group[open] > summary::after {\r
      transform: rotate(180deg) translateY(1px);\r
    }\r
\r
    aside#sidebar .param-group > .param-body {\r
      padding: 10px 9px 10px 9px;\r
    }\r
\r
    .noise-modes-row {\r
      display: flex;\r
      align-items: flex-start;\r
      gap: 8px;\r
      margin-bottom: 4px;\r
    }\r
\r
    aside#sidebar .param-group .param-body > label:not(.grow) {\r
      display: flex;\r
      align-items: center;\r
      justify-content: space-between;\r
      gap: 8px;\r
      margin: 5px 0;\r
      font-size: 0.9rem;\r
    }\r
\r
    aside#sidebar .param-group input[type="number"] {\r
      width: 7.2em;\r
      padding: 2px 4px;\r
      border-radius: 4px;\r
      border: 1px solid #444;\r
      background: #0d0d0d;\r
      color: #fff;\r
      font-size: 0.9rem;\r
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);\r
    }\r
\r
    aside#sidebar .param-group input[type="number"]:focus-visible {\r
      outline: none;\r
      border-color: var(--accent);\r
      box-shadow: 0 0 0 1px var(--accent-soft);\r
    }\r
\r
    aside#sidebar .param-group input[type="checkbox"] {\r
      transform: translateY(1px);\r
    }\r
\r
    aside#sidebar .param-group label.grow {\r
      display: flex;\r
      flex-direction: column;\r
      align-items: flex-start;\r
      gap: 6px;\r
      margin: 4px 0 8px 0;\r
      font-size: 0.9rem;\r
      width: 100%;\r
    }\r
\r
    /* Nested details inside param bodies */\r
    aside#sidebar details:not(.param-group) {\r
      width: 100%;\r
    }\r
\r
    aside#sidebar details:not(.param-group) summary {\r
      cursor: pointer;\r
      font-weight: 600;\r
      list-style: none;\r
      padding: 4px 0;\r
      font-size: 0.86rem;\r
      color: #e4e4e4;\r
    }\r
\r
    aside#sidebar details:not(.param-group) > div {\r
      display: flex;\r
      flex-direction: column;\r
      gap: 6px;\r
      margin-top: 6px;\r
      padding-left: 8px;\r
      border-left: 2px solid #2b2b2b;\r
      max-height: 240px;\r
      overflow-y: auto;\r
      overflow-x: hidden;\r
      width: 100%;\r
    }\r
\r
    aside#sidebar details:not(.param-group) label {\r
      display: flex;\r
      align-items: center;\r
      justify-content: flex-start;\r
      gap: 6px;\r
      margin: 0;\r
      white-space: normal;\r
      overflow-wrap: anywhere;\r
      font-size: 0.8rem;\r
      color: #d5d5d5;\r
    }\r
\r
    /* Buttons */\r
    #download-main,\r
    #download-tile,\r
    #download-tileset,\r
    #render-btn {\r
      display: inline-block;\r
      margin: 4px 0 12px 0;\r
      padding: 8px 12px;\r
      font-size: 0.92rem;\r
      border: 1px solid var(--accent);\r
      border-radius: 999px;\r
      background: linear-gradient(135deg, #2575fc, #21c0ff);\r
      cursor: pointer;\r
      color: #000;\r
      width: 100%;\r
      font-weight: 600;\r
      letter-spacing: 0.06em;\r
      text-transform: uppercase;\r
    }\r
\r
    #render-btn:hover {\r
      filter: brightness(1.05);\r
      box-shadow: 0 6px 18px rgba(37, 117, 252, 0.5);\r
    }\r
\r
    #apply-res {\r
      margin-top: 8px;\r
      padding: 6px 10px;\r
      font-size: 0.85rem;\r
      border-radius: 999px;\r
      border: 1px solid #666;\r
      background: #e0e0e0;\r
      cursor: pointer;\r
      color: #000;\r
      text-transform: uppercase;\r
      letter-spacing: 0.08em;\r
      width: 100%;\r
    }\r
\r
    #apply-res:hover {\r
      background: #d0d0d0;\r
    }\r
\r
    aside#sidebar select {\r
      padding: 2px 4px;\r
      border-radius: 4px;\r
      border: 1px solid #444;\r
      background: #101010;\r
      color: #fff;\r
      font-size: 0.88rem;\r
      width: 7.2em;\r
    }\r
\r
    aside#sidebar input[type="range"] {\r
      width: 100%;\r
      appearance: none;\r
      height: 4px;\r
      border-radius: 999px;\r
      background: linear-gradient(90deg, #333, #666);\r
      outline: none;\r
    }\r
\r
    aside#sidebar input[type="range"]::-webkit-slider-thumb {\r
      appearance: none;\r
      width: 12px;\r
      height: 12px;\r
      border-radius: 50%;\r
      background: #ffffff;\r
      border: 1px solid #111;\r
      box-shadow: 0 0 0 3px var(--accent-soft);\r
      cursor: pointer;\r
    }\r
\r
    aside#sidebar input[type="range"]::-moz-range-thumb {\r
      width: 12px;\r
      height: 12px;\r
      border-radius: 50%;\r
      background: #ffffff;\r
      border: 1px solid #111;\r
      box-shadow: 0 0 0 3px var(--accent-soft);\r
      cursor: pointer;\r
    }\r
\r
    .grow {\r
      flex: 1;\r
      min-width: 0;\r
    }\r
\r
    hr {\r
      border: 0;\r
      border-top: 1px solid #1f1f1f;\r
      margin: 12px 0;\r
      opacity: 0.9;\r
    }\r
\r
    @media (max-height: 720px) {\r
      .squareWrap {\r
        width: min(\r
          calc(100vw - var(--sidebar-w) - (var(--gap) * 4)),\r
          calc(100dvh - (var(--gap) * 4))\r
        );\r
      }\r
    }\r
  </style>\r
\r
  <aside id="sidebar">\r
    <div class="sidebar-header">\r
      <div class="sidebar-title">WebGPU Noise Lab</div>\r
      <div class="sidebar-subtitle">\r
        Stack fields, slice 3D volumes, inspect tiling\r
      </div>\r
    </div>\r
\r
    <nav class="sidebar-nav">\r
      <a href="#res-section" class="nav-pill">Resolution</a>\r
      <a href="#noise-params" class="nav-pill">Noise</a>\r
      <a href="#voro-params" class="nav-pill">Voronoi</a>\r
      <a href="#adv-params" class="nav-pill">Advanced</a>\r
      <a href="#overrides-group" class="nav-pill">Overrides</a>\r
      <a href="#toroidal-section" class="nav-pill">Tileset</a>\r
    </nav>\r
\r
    <details id="res-section" class="param-group">\r
      <summary>Image Settings</summary>\r
      <div class="param-body">\r
        <label>\r
          Canvas width:\r
          <input type="number" id="res-width" value="800" min="1" />\r
        </label>\r
        <label>\r
          Canvas height:\r
          <input type="number" id="res-height" value="800" min="1" />\r
        </label>\r
        <button id="apply-res" type="button">Apply resolution</button>\r
       \r
        <label>\r
          World Offset X (pixels):\r
          <input type="number" id="res-offsetX" value="0" step="1" />\r
        </label>\r
        <label>\r
          World Offset Y (pixels):\r
          <input type="number" id="res-offsetY" value="0" step="1" />\r
        </label>\r
        <label>\r
          World Offset Z (pixels):\r
          <input type="number" id="res-offsetZ" value="0" step="1" />\r
        </label>\r
\r
      </div>\r
    </details>\r
\r
    <details id="noise-params" class="param-group" open>\r
      <summary>Noise settings</summary>\r
      <div class="param-body">\r
        <div class="noise-modes-row">\r
          <label class="grow">\r
            Noise modes (additive):\r
            <details class="grow">\r
              <summary>Select noise types \u25BE</summary>\r
              <div id="noise-type-list"></div>\r
            </details>\r
          </label>\r
        </div>\r
\r
        <label>\r
          Seed:\r
          <input\r
            type="number"\r
            step="1"\r
            id="noise-seed"\r
            value="1234567890"\r
            min="1"\r
          />\r
        </label>\r
        <label>\r
          Zoom:\r
          <input type="number" step="0.1" id="noise-zoom" value="1.0" min="0.1" />\r
        </label>\r
        <label>\r
          Frequency:\r
          <input type="number" step="0.01" id="noise-freq" value="1.0" />\r
        </label>\r
        <label>\r
          Octaves:\r
          <input type="number" step="1" id="noise-octaves" value="8" min="1" />\r
        </label>\r
        <label>\r
          Lacunarity:\r
          <input\r
            type="number"\r
            step="0.1"\r
            id="noise-lacunarity"\r
            value="2.0"\r
            min="0.1"\r
          />\r
        </label>\r
        <label>\r
          Gain:\r
          <input\r
            type="number"\r
            step="0.01"\r
            id="noise-gain"\r
            value="0.5"\r
            min="0.0"\r
          />\r
        </label>\r
       \r
        <label>\r
          X step shift:\r
          <input type="number" step="0.01" id="noise-xShift" value="0" />\r
        </label>\r
        <label>\r
          Y step shift:\r
          <input type="number" step="0.01" id="noise-yShift" value="0" />\r
        </label>\r
        <label>\r
          Z step shift:\r
          <input type="number" step="0.01" id="noise-zShift" value="0" />\r
        </label>\r
        \r
      </div>\r
    </details>\r
\r
    <details id="voro-params" class="param-group">\r
      <summary>Voronoi</summary>\r
      <div class="param-body">\r
        <label>\r
          Mode:\r
          <select id="noise-voroMode" style="width: 100%">\r
            <option value="0" selected>Granite (Cell value)</option>\r
            <option value="5">Flat shade (Cells) [gap]</option>\r
            <option value="6">Flat shade (Edges) [gap]</option>\r
            <option value="4">Edge threshold (Gap gate) [gap]</option>\r
            <option value="3">Edges (Continuous) [gap]</option>\r
            <option value="2">Interior (F2 \u2212 F1) [gap]</option>\r
\r
            <option value="10">Flat shade (Cells) [sq]</option>\r
            <option value="11">Flat shade (Edges) [sq]</option>\r
            <option value="9">Edge threshold (Gap gate) [sq]</option>\r
            <option value="8">Edges (Continuous) [sq]</option>\r
            <option value="7">Interior (F2\xB2 \u2212 F1\xB2) [sq]</option>\r
            <option value="1">F1 distance</option>\r
            <option value="12">F1 threshold (Gate)</option>\r
            <option value="13">F1 mask (Smooth)</option>\r
            <option value="14">F1 mask (Smooth inv)</option>\r
            <option value="15">Edge falloff (1 / (1 + gap*k))</option>\r
            <option value="16">Edge falloff (1 / (1 + gapSq*k))</option>\r
          </select>\r
        </label>\r
\r
        <label>\r
          Threshold:\r
          <input type="number" step="0.01" id="noise-threshold" value="0.1" />\r
        </label>\r
\r
        <label>\r
          Edge softness (edgeK):\r
          <input type="number" step="0.01" id="noise-edgeK" value="0.0" />\r
        </label>\r
      </div>\r
    </details>\r
\r
    <details id="adv-params" class="param-group">\r
      <summary>Advanced params</summary>\r
      <div class="param-body">\r
        <label>\r
          Seed angle:\r
          <input type="number" step="0.01" id="noise-seedAngle" value="0.0" />\r
        </label>\r
\r
        <label>\r
          Turbulence:\r
          <input type="checkbox" id="noise-turbulence" />\r
        </label>\r
\r
        <label>\r
          Time:\r
          <input type="number" step="0.01" id="noise-time" value="0.0" />\r
        </label>\r
\r
        <label>\r
          Warp amp:\r
          <input type="number" step="0.01" id="noise-warpAmp" value="0.5" />\r
        </label>\r
\r
        <label>\r
          Gabor radius:\r
          <input type="number" step="0.01" id="noise-gaborRadius" value="4.0" />\r
        </label>\r
\r
        <label>\r
          Terrace step:\r
          <input type="number" step="0.01" id="noise-terraceStep" value="8.0" />\r
        </label>\r
\r
        <label>\r
          Exp1:\r
          <input type="number" step="0.01" id="noise-exp1" value="1.0" />\r
        </label>\r
\r
        <label>\r
          Exp2:\r
          <input type="number" step="0.01" id="noise-exp2" value="0.0" />\r
        </label>\r
\r
        <label>\r
          Ripple freq:\r
          <input type="number" step="0.01" id="noise-rippleFreq" value="10.0" />\r
        </label>\r
      </div>\r
    </details>\r
\r
    <button id="render-btn" type="button">Render</button>\r
\r
    <div id="export-bg">\r
      <div class="export-bg-title">Export BG</div>\r
      <label>\r
        <input\r
          type="radio"\r
          name="export-bg"\r
          id="export-bg-transparent"\r
          value="transparent"\r
          checked\r
        />\r
        Transparent\r
      </label>\r
\r
      <label>\r
        <input\r
          type="radio"\r
          name="export-bg"\r
          id="export-bg-black"\r
          value="black"\r
        />\r
        Black\r
      </label>\r
\r
      <label>\r
        <input\r
          type="radio"\r
          name="export-bg"\r
          id="export-bg-white"\r
          value="white"\r
        />\r
        White\r
      </label>\r
    </div>\r
\r
    <button id="download-main" type="button">Save image</button>\r
    <button id="download-tile" type="button">Save tile</button>\r
    <button id="download-tileset" type="button">Save tileset</button>\r
\r
    <details id="overrides-group" class="param-group">\r
      <summary>Per entry overrides</summary>\r
      <div class="param-body">\r
        <label>\r
          Entry:\r
          <select id="override-mode" style="width: 100%"></select>\r
        </label>\r
\r
        <label>\r
          Zoom:\r
          <input type="number" id="ov-zoom" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Frequency:\r
          <input type="number" id="ov-freq" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Lacunarity:\r
          <input type="number" id="ov-lacunarity" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Gain:\r
          <input type="number" id="ov-gain" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Octaves:\r
          <input type="number" id="ov-octaves" step="1" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Turbulence:\r
          <select id="ov-turbulence" style="width: 7.2em">\r
            <option value="">inherit</option>\r
            <option value="0">0</option>\r
            <option value="1">1</option>\r
          </select>\r
        </label>\r
\r
        <label>\r
          Seed angle:\r
          <input type="number" id="ov-seedAngle" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Exp1:\r
          <input type="number" id="ov-exp1" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Exp2:\r
          <input type="number" id="ov-exp2" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Ripple freq:\r
          <input type="number" id="ov-rippleFreq" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Time:\r
          <input type="number" id="ov-time" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Warp amp:\r
          <input type="number" id="ov-warp" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Threshold:\r
          <input type="number" id="ov-threshold" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Voronoi mode:\r
          <select id="ov-voroMode" style="width: 7.2em">\r
            <option value="">inherit</option>\r
            <option value="0">granite</option>\r
            <option value="5">flat cells</option>\r
            <option value="6">flat edges</option>\r
            <option value="4">edge gate</option>\r
            <option value="3">edges</option>\r
            <option value="1">f1</option>\r
            <option value="2">gap</option>\r
          </select>\r
        </label>\r
\r
        <label>\r
          EdgeK:\r
          <input type="number" id="ov-edgeK" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Gabor radius:\r
          <input type="number" id="ov-gabor" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          Terrace step:\r
          <input type="number" id="ov-terraceStep" step="0.01" placeholder="" />\r
        </label>\r
\r
        <label>\r
          X shift:\r
          <input type="number" id="ov-xShift" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Y shift:\r
          <input type="number" id="ov-yShift" step="0.01" placeholder="" />\r
        </label>\r
        <label>\r
          Z shift:\r
          <input type="number" id="ov-zShift" step="0.01" placeholder="" />\r
        </label>\r
\r
        <button id="ov-clear" type="button" style="width: 100%; margin-top: 8px">\r
          Clear overrides for entry\r
        </button>\r
      </div>\r
    </details>\r
\r
    <hr />\r
\r
    <details id="toroidal-section" class="param-group">\r
      <summary>Tileset Controls</summary>\r
      <div class="param-body">\r
        <label class="grow">\r
          Volume 4D modes (additive):\r
          <details class="grow">\r
            <summary>Select 4D types \u25BE</summary>\r
            <div id="toroidal-type-list"></div>\r
          </details>\r
        </label>\r
\r
        <label>\r
          Slice index:\r
          <input type="number" id="z-slice-num" min="0" max="127" value="64" />\r
        </label>\r
      </div>\r
    </details>\r
  </aside>\r
\r
  <main id="main">\r
    <div id="view-stack" class="content">\r
      <div class="stage">\r
        <input type="radio" name="view-tab" id="view-tab-preview" checked />\r
        <input type="radio" name="view-tab" id="view-tab-tileset" />\r
\r
        <div class="preview-header">\r
          <div id="preview-meta">Height field preview</div>\r
          <div id="preview-stats"></div>\r
        </div>\r
\r
        <div class="stage-tabs" role="tablist" aria-label="Preview tabs">\r
          <label class="stage-tab" for="view-tab-preview">Main</label>\r
          <label class="stage-tab" for="view-tab-tileset">Tileset</label>\r
        </div>\r
\r
        <div class="squareWrap stageWrap">\r
          <div class="stage-panel stage-preview">\r
            <canvas id="noise-canvas"></canvas>\r
          </div>\r
\r
          <div class="stage-panel stage-tileset">\r
            \r
        <label>\r
          Z slice (0 to 127):\r
          <input type="range" id="z-slice" min="0" max="127" value="64" />\r
        </label>\r
            <div id="mosaic"></div>\r
          </div>\r
        </div>\r
\r
        <div class="stage-footer">\r
          <p id="mosaic-caption" class="mosaic-caption"></p>\r
        </div>\r
      </div>\r
    </div>\r
  </main>\r
</div>\r
`;var be=`const PI : f32 = 3.141592653589793;\r
const TWO_PI : f32 = 6.283185307179586;\r
\r
const ANGLE_INCREMENT : f32 = PI / 4.0;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 options UBO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
struct NoiseComputeOptions {\r
  getGradient : u32,\r
  useCustomPos : u32,\r
  outputChannel : u32,\r
  ioFlags : u32,\r
  baseRadius : f32,\r
  heightScale : f32,\r
  _pad1 : f32,\r
  _pad2 : f32,\r
};\r
@group(0) @binding(0) var<uniform> options : NoiseComputeOptions;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 params UBO (layout kept) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
struct NoiseParams {\r
  seed : u32,\r
  zoom : f32,\r
  freq : f32,\r
  octaves : u32,\r
  lacunarity : f32,\r
  gain : f32,\r
  xShift : f32,\r
  yShift : f32,\r
  zShift : f32,\r
  turbulence : u32,\r
  seedAngle : f32,\r
  exp1 : f32,\r
  exp2 : f32,\r
  threshold : f32,\r
  rippleFreq : f32,\r
  time : f32,\r
  warpAmp : f32,\r
  gaborRadius : f32,\r
  terraceStep : f32,\r
  toroidal : u32,\r
  voroMode : u32,\r
  edgeK:     f32\r
};\r
@group(0) @binding(1) var<uniform> params : NoiseParams;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 permutation table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
struct PermTable { values : array<u32, 512>, };\r
const PERM_SIZE : u32 = 512u;\r
const PERM_MASK : u32 = PERM_SIZE - 1u;\r
const INV_255 : f32 = 1.0 / 255.0;\r
const INV_2_OVER_255 : f32 = 2.0 / 255.0;\r
\r
@group(0) @binding(2) var<storage, read> permTable : PermTable;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 IO resources \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@group(0) @binding(3) var inputTex : texture_2d_array<f32>;\r
@group(0) @binding(4) var outputTex : texture_storage_2d_array<rgba16float, write>;\r
@group(0) @binding(5) var<storage, read> posBuf : array<vec4<f32>>;\r
\r
struct Frame {\r
  fullWidth : u32,\r
  fullHeight : u32,\r
  tileWidth : u32,\r
  tileHeight : u32,\r
\r
  originX : i32,\r
  originY : i32,\r
  originZ : i32,\r
  fullDepth : u32,\r
\r
  tileDepth : u32,\r
  layerIndex : i32,\r
  layers : u32,\r
  _pad : u32,\r
\r
  originXf : f32,\r
  originYf : f32,\r
  originZf : f32,\r
  _pad1    : f32,\r
};\r
@group(0) @binding(6) var<uniform> frame : Frame;\r
\r
@group(0) @binding(7) var inputTex3D : texture_3d<f32>;\r
@group(0) @binding(8) var outputTex3D : texture_storage_3d<rgba16float, write>;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 small utilities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn clampZ(z: i32)->i32 {\r
  let depth = i32(max(u32(frame.fullDepth), 1u));\r
  return clamp(z, 0, depth - 1);\r
}\r
fn layerToZ(layerIndex:i32, layers:u32)->f32 {\r
  if (layers <= 1u) { return 0.0; }\r
  let li = max(layerIndex, 0);\r
  return f32(li) / f32(layers - 1u);\r
}\r
fn readFrom3D()->bool { return (options.ioFlags & 0x1u) != 0u; }\r
fn writeTo3D()->bool { return (options.ioFlags & 0x2u) != 0u; }\r
\r
fn loadPrevRGBA(fx:i32, fy:i32, fz:i32)->vec4<f32> {\r
  if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(fx, fy, clampZ(fz)), 0); }\r
  return textureLoad(inputTex, vec2<i32>(fx, fy), frame.layerIndex, 0);\r
}\r
fn storeRGBA(fx:i32, fy:i32, fz:i32, col:vec4<f32>) {\r
  if (writeTo3D()) { textureStore(outputTex3D, vec3<i32>(fx, fy, clampZ(fz)), col); }\r
  else { textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, col); }\r
}\r
\r
const STEREO_SCALE : f32 = 1.8;          // fixed packing scale for Clifford torus\r
const INV_SQRT2    : f32 = 0.7071067811865476; // 1/\u221A2\r
\r
// add next to your other constants\r
const U_SCALE : f32 = 3.0;\r
const V_SCALE : f32 = 3.0;\r
const T_SCALE : f32 = 2.0;\r
const PACK_BIAS : vec4<f32> = vec4<f32>(0.37, 0.21, 0.29, 0.31);\r
\r
fn packPeriodicUV(u: f32, v: f32, theta: f32) -> vec4<f32> {\r
  let aU = fract(u) * TWO_PI;\r
  let aV = fract(v) * TWO_PI;\r
  let aT = fract(theta) * TWO_PI;\r
\r
  let x = cos(aU) * U_SCALE;\r
  let y = sin(aU) * U_SCALE;\r
  let z = cos(aV) * V_SCALE + cos(aT) * T_SCALE;\r
  let w = sin(aV) * V_SCALE + sin(aT) * T_SCALE;\r
\r
  return vec4<f32>(x, y, z, w) + PACK_BIAS;\r
}\r
\r
\r
fn thetaFromDepth(fz: i32) -> f32 {\r
  let uses3D = writeTo3D() || readFrom3D();\r
  if (uses3D) {\r
    let d = max(f32(frame.fullDepth), 1.0);\r
    return (f32(clampZ(fz)) + 0.5) / d; // [0,1)\r
  }\r
  return layerToZ(frame.layerIndex, frame.layers);\r
}\r
\r
fn fetchPos(fx: i32, fy: i32, fz: i32) -> vec3<f32> {\r
  if (options.useCustomPos == 1u) {\r
    let use3D = writeTo3D() || readFrom3D();\r
    let slice_i = select(frame.layerIndex, clampZ(fz), use3D);\r
    let slice = u32(max(slice_i, 0));\r
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);\r
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);\r
    let idx = slice * frame.fullWidth * frame.fullHeight + u32(cy) * frame.fullWidth + u32(cx);\r
    return posBuf[idx].xyz;\r
  }\r
\r
  if (params.toroidal == 1u) {\r
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);\r
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);\r
\r
    let invW = 1.0 / max(f32(frame.fullWidth), 1.0);\r
    let invH = 1.0 / max(f32(frame.fullHeight), 1.0);\r
\r
    let U = (f32(cx) + 0.5) * invW;   // [0,1)\r
    let V = (f32(cy) + 0.5) * invH;   // [0,1)\r
    let theta = thetaFromDepth(fz);   // [0,1)\r
\r
    return vec3<f32>(U, V, theta);\r
  }\r
\r
  let invW = 1.0 / max(f32(frame.fullWidth), 1.0);\r
  let invH = 1.0 / max(f32(frame.fullHeight), 1.0);\r
\r
  var ox = frame.originXf;\r
  var oy = frame.originYf;\r
  if (ox == 0.0 && oy == 0.0) {\r
    ox = f32(frame.originX);\r
    oy = f32(frame.originY);\r
  }\r
\r
  let x = (ox + f32(fx)) * invW;\r
  let y = (oy + f32(fy)) * invH;\r
\r
  var z: f32;\r
  let uses3D = writeTo3D() || readFrom3D();\r
  if (uses3D) {\r
    if (frame.fullDepth <= 1u) { z = 0.0; }\r
    else { z = f32(clampZ(fz)) / f32(frame.fullDepth - 1u); }\r
  } else {\r
    z = layerToZ(frame.layerIndex, frame.layers);\r
  }\r
\r
  return vec3<f32>(x, y, z);\r
}\r
\r
\r
\r
\r
fn writeChannel(fx:i32, fy:i32, fz:i32, v0:f32, channel:u32, overwrite:u32) {\r
  let needsAccum = (overwrite == 0u);\r
  let writesAll = (channel == 0u);\r
  let skipRead = (!needsAccum) && (writesAll || channel == 5u);\r
  var inCol = vec4<f32>(0.0);\r
  if (!skipRead) { inCol = loadPrevRGBA(fx, fy, fz); }\r
  var outCol = inCol;\r
\r
  if (channel == 0u)      { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol = vec4<f32>(h, h, h, h); }\r
  else if (channel == 1u) { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol.x = h; }\r
  else if (channel == 2u) { let h = select(v0 + inCol.y, v0, overwrite == 1u); outCol.y = h; }\r
  else if (channel == 3u) { let h = select(v0 + inCol.z, v0, overwrite == 1u); outCol.z = h; }\r
  else if (channel == 4u) { let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol.w = h; }\r
  else if (channel == 5u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, p.z, h); }\r
  else if (channel == 6u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, h, inCol.w); }\r
\r
  storeRGBA(fx, fy, fz, outCol);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 math / noise bits \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
/* gradient tables */\r
const GRAD2 : array<vec2<f32>, 8> = array<vec2<f32>, 8>(\r
  vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0,  1.0),\r
  vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0, -1.0),\r
  vec2<f32>( 1.0,  0.0), vec2<f32>(-1.0,  0.0),\r
  vec2<f32>( 0.0,  1.0), vec2<f32>( 0.0, -1.0)\r
);\r
\r
const GRAD3 : array<vec3<f32>, 12> = array<vec3<f32>, 12>(\r
  vec3<f32>( 1.0,  1.0,  0.0), vec3<f32>(-1.0,  1.0,  0.0),\r
  vec3<f32>( 1.0, -1.0,  0.0), vec3<f32>(-1.0, -1.0,  0.0),\r
  vec3<f32>( 1.0,  0.0,  1.0), vec3<f32>(-1.0,  0.0,  1.0),\r
  vec3<f32>( 1.0,  0.0, -1.0), vec3<f32>(-1.0,  0.0, -1.0),\r
  vec3<f32>( 0.0,  1.0,  1.0), vec3<f32>( 0.0, -1.0,  1.0),\r
  vec3<f32>( 0.0,  1.0, -1.0), vec3<f32>( 0.0, -1.0, -1.0)\r
);\r
const GRAD4 : array<vec4<f32>, 32> = array<vec4<f32>, 32>(\r
  vec4<f32>( 0.0,  1.0,  1.0,  1.0), vec4<f32>( 0.0,  1.0,  1.0, -1.0),\r
  vec4<f32>( 0.0,  1.0, -1.0,  1.0), vec4<f32>( 0.0,  1.0, -1.0, -1.0),\r
  vec4<f32>( 0.0, -1.0,  1.0,  1.0), vec4<f32>( 0.0, -1.0,  1.0, -1.0),\r
  vec4<f32>( 0.0, -1.0, -1.0,  1.0), vec4<f32>( 0.0, -1.0, -1.0, -1.0),\r
\r
  vec4<f32>( 1.0,  0.0,  1.0,  1.0), vec4<f32>( 1.0,  0.0,  1.0, -1.0),\r
  vec4<f32>( 1.0,  0.0, -1.0,  1.0), vec4<f32>( 1.0,  0.0, -1.0, -1.0),\r
  vec4<f32>(-1.0,  0.0,  1.0,  1.0), vec4<f32>(-1.0,  0.0,  1.0, -1.0),\r
  vec4<f32>(-1.0,  0.0, -1.0,  1.0), vec4<f32>(-1.0,  0.0, -1.0, -1.0),\r
\r
  vec4<f32>( 1.0,  1.0,  0.0,  1.0), vec4<f32>( 1.0,  1.0,  0.0, -1.0),\r
  vec4<f32>( 1.0, -1.0,  0.0,  1.0), vec4<f32>( 1.0, -1.0,  0.0, -1.0),\r
  vec4<f32>(-1.0,  1.0,  0.0,  1.0), vec4<f32>(-1.0,  1.0,  0.0, -1.0),\r
  vec4<f32>(-1.0, -1.0,  0.0,  1.0), vec4<f32>(-1.0, -1.0,  0.0, -1.0),\r
\r
  vec4<f32>( 1.0,  1.0,  1.0,  0.0), vec4<f32>( 1.0,  1.0, -1.0,  0.0),\r
  vec4<f32>( 1.0, -1.0,  1.0,  0.0), vec4<f32>( 1.0, -1.0, -1.0,  0.0),\r
  vec4<f32>(-1.0,  1.0,  1.0,  0.0), vec4<f32>(-1.0,  1.0, -1.0,  0.0),\r
  vec4<f32>(-1.0, -1.0,  1.0,  0.0), vec4<f32>(-1.0, -1.0, -1.0,  0.0)\r
);\r
\r
/* Gradient accessors */\r
fn gradient(idx:u32)->vec3<f32> {\r
  return GRAD3[idx % 12u];\r
}\r
fn gradient2(idx:u32)->vec2<f32> {\r
  return GRAD2[idx % 8u];\r
}\r
fn gradient4(idx: u32) -> vec4<f32> {\r
  return GRAD4[idx % 32u];\r
}\r
\r
\r
fn fade(t:f32)->f32 { return t*t*t*(t*(t*6.0 - 15.0) + 10.0); }\r
fn lerp(a:f32, b:f32, t:f32)->f32 { return a + t * (b - a); }\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 perm/hash helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn perm(idx: u32) -> u32 {\r
  return permTable.values[idx & PERM_MASK];\r
}\r
\r
fn rot3(p: vec3<f32>) -> vec3<f32> {\r
  let x = 0.00 * p.x + -0.80 * p.y + -0.60 * p.z;\r
  let y = 0.80 * p.x +  0.36 * p.y + -0.48 * p.z;\r
  let z = 0.60 * p.x + -0.48 * p.y +  0.64 * p.z;\r
  return vec3<f32>(x, y, z);\r
}\r
\r
fn hash2(ix : i32, iy : i32) -> u32 {\r
  return perm((u32(ix) & PERM_MASK) + perm(u32(iy) & PERM_MASK)) & PERM_MASK;\r
}\r
fn rand2(ix : i32, iy : i32) -> f32 {\r
  let idx = hash2(ix, iy);\r
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;\r
}\r
fn rand2u(ix : i32, iy : i32) -> f32 {\r
  let idx = hash2(ix, iy);\r
  return f32(perm(idx)) * INV_255;\r
}\r
\r
// 3D helpers\r
fn hash3(ix : i32, iy : i32, iz : i32) -> u32 {\r
  return perm((u32(ix) & PERM_MASK)\r
            + perm((u32(iy) & PERM_MASK) + perm(u32(iz) & PERM_MASK)))\r
         & PERM_MASK;\r
}\r
fn rand3(ix : i32, iy : i32, iz : i32) -> f32 {\r
  let idx = hash3(ix, iy, iz);\r
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;\r
}\r
fn rand3u(ix : i32, iy : i32, iz : i32) -> f32 {\r
  let idx = hash3(ix, iy, iz);\r
  return f32(perm(idx)) * INV_255;\r
}\r
\r
// 4D helpers\r
fn hash4(ix : i32, iy : i32, iz : i32, iw : i32) -> u32 {\r
  let a = perm(u32(ix) & PERM_MASK);\r
  let b = perm((u32(iy) & PERM_MASK) + a);\r
  let c = perm((u32(iz) & PERM_MASK) + b);\r
  return perm((u32(iw) & PERM_MASK) + c) & PERM_MASK;\r
}\r
fn rand4(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {\r
  let idx = hash4(ix, iy, iz, iw);\r
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;\r
}\r
fn rand4u(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {\r
  let idx = hash4(ix, iy, iz, iw);\r
  return f32(perm(idx)) * INV_255;\r
}\r
\r
/* ---------- classic 2D Perlin ---------- */\r
fn noise2D(p : vec2<f32>) -> f32 {\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
\r
  let u = fade(xf);\r
  let v = fade(yf);\r
\r
  let A  = perm(X) + Y;\r
  let B  = perm((X + 1u) & PERM_MASK) + Y;\r
\r
  let gAA = gradient2(perm(A & PERM_MASK));\r
  let gBA = gradient2(perm(B & PERM_MASK));\r
  let gAB = gradient2(perm((A + 1u) & PERM_MASK));\r
  let gBB = gradient2(perm((B + 1u) & PERM_MASK));\r
\r
  let x1 = lerp(dot(gAA, vec2<f32>(xf,       yf      )),\r
                dot(gBA, vec2<f32>(xf - 1.0, yf      )), u);\r
  let x2 = lerp(dot(gAB, vec2<f32>(xf,       yf - 1.0)),\r
                dot(gBB, vec2<f32>(xf - 1.0, yf - 1.0)), u);\r
  return lerp(x1, x2, v);\r
}\r
\r
//matches 3d z=0 slice, less multiplying\r
fn noise2D_from_3D(p: vec3<f32>) -> f32 {\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
  let u = fade(xf);\r
  let v = fade(yf);\r
\r
  // 3D hashing path with Z = 0\r
  let A  = perm(X) + Y;\r
  let AA = perm(A & PERM_MASK);                 // + Z(=0)\r
  let AB = perm((A + 1u) & PERM_MASK);          // + Z(=0)\r
  let B  = perm((X + 1u) & PERM_MASK) + Y;\r
  let BA = perm(B & PERM_MASK);                 // + Z(=0)\r
  let BB = perm((B + 1u) & PERM_MASK);          // + Z(=0)\r
\r
  let gAA = gradient(perm(AA & PERM_MASK));\r
  let gBA = gradient(perm(BA & PERM_MASK));\r
  let gAB = gradient(perm(AB & PERM_MASK));\r
  let gBB = gradient(perm(BB & PERM_MASK));\r
\r
  let n00 = dot(gAA, vec3<f32>(xf,       yf,       0.0));\r
  let n10 = dot(gBA, vec3<f32>(xf - 1.0, yf,       0.0));\r
  let n01 = dot(gAB, vec3<f32>(xf,       yf - 1.0, 0.0));\r
  let n11 = dot(gBB, vec3<f32>(xf - 1.0, yf - 1.0, 0.0));\r
\r
  let nx0 = lerp(n00, n10, u);\r
  let nx1 = lerp(n01, n11, u);\r
  return lerp(nx0, nx1, v);\r
}\r
\r
/* ---------- classic 3D Perlin ---------- */\r
fn noise3D(p: vec3<f32>) -> f32 {\r
  if (p.z == 0.0) { return noise2D_from_3D(p); }\r
\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let iz = i32(floor(p.z));\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
  let Z: u32 = u32(iz) & PERM_MASK;\r
\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
  let zf = p.z - floor(p.z);\r
\r
  let u = fade(xf);\r
  let v = fade(yf);\r
  let w = fade(zf);\r
\r
  let A  = perm(X) + Y;\r
  let AA = perm(A & PERM_MASK) + Z;\r
  let AB = perm((A + 1u) & PERM_MASK) + Z;\r
  let B  = perm((X + 1u) & PERM_MASK) + Y;\r
  let BA = perm(B & PERM_MASK) + Z;\r
  let BB = perm((B + 1u) & PERM_MASK) + Z;\r
\r
  let gAA  = gradient(perm(AA & PERM_MASK));\r
  let gBA  = gradient(perm(BA & PERM_MASK));\r
  let gAB  = gradient(perm(AB & PERM_MASK));\r
  let gBB  = gradient(perm(BB & PERM_MASK));\r
  let gAA1 = gradient(perm((AA + 1u) & PERM_MASK));\r
  let gBA1 = gradient(perm((BA + 1u) & PERM_MASK));\r
  let gAB1 = gradient(perm((AB + 1u) & PERM_MASK));\r
  let gBB1 = gradient(perm((BB + 1u) & PERM_MASK));\r
\r
  let x1 = lerp(dot(gAA,  vec3<f32>(xf,       yf,       zf      )),\r
                dot(gBA,  vec3<f32>(xf - 1.0, yf,       zf      )), u);\r
  let x2 = lerp(dot(gAB,  vec3<f32>(xf,       yf - 1.0, zf      )),\r
                dot(gBB,  vec3<f32>(xf - 1.0, yf - 1.0, zf      )), u);\r
  let y1 = lerp(x1, x2, v);\r
\r
  let x3 = lerp(dot(gAA1, vec3<f32>(xf,       yf,       zf - 1.0)),\r
                dot(gBA1, vec3<f32>(xf - 1.0, yf,       zf - 1.0)), u);\r
  let x4 = lerp(dot(gAB1, vec3<f32>(xf,       yf - 1.0, zf - 1.0)),\r
                dot(gBB1, vec3<f32>(xf - 1.0, yf - 1.0, zf - 1.0)), u);\r
  let y2 = lerp(x3, x4, v);\r
\r
  return lerp(y1, y2, w);\r
}\r
\r
\r
/* ---------- 4D Perlin (hypercube corners, gradient-based) ---------- */\r
fn noise4D(p: vec4<f32>) -> f32 {\r
  // integer cell coords\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let iz = i32(floor(p.z));\r
  let iw = i32(floor(p.w));\r
\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
  let Z: u32 = u32(iz) & PERM_MASK;\r
  let W: u32 = u32(iw) & PERM_MASK;\r
\r
  // fractional part\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
  let zf = p.z - floor(p.z);\r
  let wf = p.w - floor(p.w);\r
\r
  let u = fade(xf);\r
  let v = fade(yf);\r
  let t = fade(zf);\r
  let s = fade(wf);\r
\r
  // helper to get corner gradient and dot product\r
  // corner offsets are dx,dy,dz,dw in {0,1}\r
  // for fractional component, use (xf - dx) etc; for dw=1 use (wf - 1.0)\r
  // compute hash for corner using hash4(ix+dx, iy+dy, iz+dz, iw+dw)\r
  let d0000 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf,       yf,       zf,       wf      ));\r
  let d1000 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf,       wf      ));\r
  let d0100 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf,       wf      ));\r
  let d1100 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf      ));\r
\r
  let d0010 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf,       yf,       zf - 1.0, wf      ));\r
  let d1010 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf      ));\r
  let d0110 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf      ));\r
  let d1110 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf      ));\r
\r
  let d0001 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf,       yf,       zf,       wf - 1.0));\r
  let d1001 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf,       wf - 1.0));\r
  let d0101 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf,       wf - 1.0));\r
  let d1101 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf - 1.0));\r
\r
  let d0011 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf,       yf,       zf - 1.0, wf - 1.0));\r
  let d1011 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf - 1.0));\r
  let d0111 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf - 1.0));\r
  let d1111 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf - 1.0));\r
\r
  // interpolate along x -> y -> z for w=0 layer\r
  let x00 = lerp(d0000, d1000, u);\r
  let x10 = lerp(d0100, d1100, u);\r
  let y0  = lerp(x00, x10, v);\r
\r
  let x01 = lerp(d0010, d1010, u);\r
  let x11 = lerp(d0110, d1110, u);\r
  let y1  = lerp(x01, x11, v);\r
\r
  let zLayer0 = lerp(y0, y1, t);\r
\r
  // interpolate for w=1 layer\r
  let x00w = lerp(d0001, d1001, u);\r
  let x10w = lerp(d0101, d1101, u);\r
  let y0w  = lerp(x00w, x10w, v);\r
\r
  let x01w = lerp(d0011, d1011, u);\r
  let x11w = lerp(d0111, d1111, u);\r
  let y1w  = lerp(x01w, x11w, v);\r
\r
  let zLayer1 = lerp(y0w, y1w, t);\r
\r
  // final interp along w\r
  return lerp(zLayer0, zLayer1, s);\r
}\r
\r
fn worley3D(p : vec3<f32>) -> f32 {\r
    let fx = i32(floor(p.x));\r
    let fy = i32(floor(p.y));\r
    let fz = i32(floor(p.z));\r
    var minD : f32 = 1e9;\r
    for (var dz = -1; dz <= 1; dz = dz + 1) {\r
      for (var dy = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx = -1; dx <= 1; dx = dx + 1) {\r
          let xi = fx + dx;\r
          let yi = fy + dy;\r
          let zi = fz + dz;\r
          let px = f32(xi) + rand3u(xi, yi, zi);\r
          let py = f32(yi) + rand3u(yi, zi, xi);\r
          let pz = f32(zi) + rand3u(zi, xi, yi);\r
          let dxv = px - p.x;\r
          let dyv = py - p.y;\r
          let dzv = pz - p.z;\r
          let d2 = dxv*dxv + dyv*dyv + dzv*dzv;\r
          if (d2 < minD) { minD = d2; }\r
        }\r
      }\r
    }\r
    return sqrt(minD);\r
  \r
}\r
\r
\r
/* ---------- 4D Worley (cellular) ---------- */\r
// fn worley4D(p: vec4<f32>) -> f32 {\r
//   let fx = i32(floor(p.x));\r
//   let fy = i32(floor(p.y));\r
//   let fz = i32(floor(p.z));\r
//   let fw = i32(floor(p.w));\r
\r
//   var minDistSq : f32 = 1e9;\r
\r
//   // iterate neighbor cells in 4D (3^4 = 81)\r
//   for (var dw = -1; dw <= 1; dw = dw + 1) {\r
//     for (var dz = -1; dz <= 1; dz = dz + 1) {\r
//       for (var dy = -1; dy <= 1; dy = dy + 1) {\r
//         for (var dx = -1; dx <= 1; dx = dx + 1) {\r
//           let xi = fx + dx;\r
//           let yi = fy + dy;\r
//           let zi = fz + dz;\r
//           let wi = fw + dw;\r
\r
//           // jitter within each cell using rotated rand4u calls to decorrelate axes\r
//           let rx = rand4u(xi, yi, zi, wi);\r
//           let ry = rand4u(yi, zi, wi, xi);\r
//           let rz = rand4u(zi, wi, xi, yi);\r
//           let rw = rand4u(wi, xi, yi, zi);\r
\r
//           let px = f32(xi) + rx;\r
//           let py = f32(yi) + ry;\r
//           let pz = f32(zi) + rz;\r
//           let pw = f32(wi) + rw;\r
\r
//           let dxv = px - p.x;\r
//           let dyv = py - p.y;\r
//           let dzv = pz - p.z;\r
//           let dwv = pw - p.w;\r
//           let d2 = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;\r
//           if (d2 < minDistSq) { minDistSq = d2; }\r
//         }\r
//       }\r
//     }\r
//   }\r
\r
//   return sqrt(minDistSq);\r
// }\r
\r
\r
fn cellular3D(p : vec3<f32>) -> f32 {\r
    let fx = i32(floor(p.x));\r
    let fy = i32(floor(p.y));\r
    let fz = i32(floor(p.z));\r
    var d1 : f32 = 1e9; var d2 : f32 = 1e9;\r
    for (var dz = -1; dz <= 1; dz++) {\r
      for (var dy = -1; dy <= 1; dy++) {\r
        for (var dx = -1; dx <= 1; dx++) {\r
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;\r
          let px = f32(xi) + rand3u(xi, yi, zi);\r
          let py = f32(yi) + rand3u(yi, zi, xi);\r
          let pz = f32(zi) + rand3u(zi, xi, yi);\r
          let dd = (px - p.x)*(px - p.x) + (py - p.y)*(py - p.y) + (pz - p.z)*(pz - p.z);\r
          if (dd < d1) { d2 = d1; d1 = dd; }\r
          else if (dd < d2) { d2 = dd; }\r
        }\r
      }\r
    }\r
    return d2 - d1;\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2-D Simplex  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn simplex2D(p : vec2<f32>) -> f32 {\r
  let F2 : f32 = 0.3660254037844386;  // (\u221A3-1)/2\r
  let G2 : f32 = 0.2113248654051871;  // (3-\u221A3)/6\r
\r
  // Skew to simplex grid\r
  let s  = (p.x + p.y) * F2;\r
  let i  = i32(floor(p.x + s));\r
  let j  = i32(floor(p.y + s));\r
  let t  = f32(i + j) * G2;\r
\r
  let X0 = f32(i) - t;\r
  let Y0 = f32(j) - t;\r
  let x0 = p.x - X0;\r
  let y0 = p.y - Y0;\r
\r
  // Simplex corner order\r
  var i1u : u32 = 0u;\r
  var j1u : u32 = 0u;\r
  if (x0 > y0) { i1u = 1u; } else { j1u = 1u; }\r
\r
  // Offsets for remaining corners\r
  let x1 = x0 - f32(i1u) + G2;\r
  let y1 = y0 - f32(j1u) + G2;\r
  let x2 = x0 - 1.0 + 2.0 * G2;\r
  let y2 = y0 - 1.0 + 2.0 * G2;\r
\r
  // Hashed gradients (mod 8 for 2D gradient table)\r
  let ii  = u32(i) & PERM_MASK;\r
  let jj  = u32(j) & PERM_MASK;\r
  let gi0 = perm(ii + perm(jj)) & 7u;\r
  let gi1 = perm(ii + i1u + perm((jj + j1u) & PERM_MASK)) & 7u;\r
  let gi2 = perm((ii + 1u) + perm((jj + 1u) & PERM_MASK)) & 7u;\r
\r
  // Contributions from each corner\r
  var t0 = 0.5 - x0 * x0 - y0 * y0;\r
  var n0 : f32 = 0.0;\r
  if (t0 > 0.0) {\r
    t0 *= t0;\r
    n0 = t0 * t0 * dot(gradient2(gi0), vec2<f32>(x0, y0));\r
  }\r
\r
  var t1 = 0.5 - x1 * x1 - y1 * y1;\r
  var n1 : f32 = 0.0;\r
  if (t1 > 0.0) {\r
    t1 *= t1;\r
    n1 = t1 * t1 * dot(gradient2(gi1), vec2<f32>(x1, y1));\r
  }\r
\r
  var t2 = 0.5 - x2 * x2 - y2 * y2;\r
  var n2 : f32 = 0.0;\r
  if (t2 > 0.0) {\r
    t2 *= t2;\r
    n2 = t2 * t2 * dot(gradient2(gi2), vec2<f32>(x2, y2));\r
  }\r
\r
  // Same scale used in the standard reference implementation\r
  return 70.0 * (n0 + n1 + n2);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 3-D Simplex Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// Call it like: let v = simplex3D(vec3<f32>(x,y,z));\r
\r
fn simplex3D(pos : vec3<f32>) -> f32 {\r
    // Skew/\u200Bunskew factors for 3D\r
    let F3 : f32 = 1.0 / 3.0;\r
    let G3 : f32 = 1.0 / 6.0;\r
\r
    // Skew the input space to find the simplex cell\r
    let s  = (pos.x + pos.y + pos.z) * F3;\r
    let i_f = floor(pos.x + s);\r
    let j_f = floor(pos.y + s);\r
    let k_f = floor(pos.z + s);\r
\r
    let i = i32(i_f);\r
    let j = i32(j_f);\r
    let k = i32(k_f);\r
\r
    // Unskew back to (x,y,z) space\r
    let t0 = f32(i + j + k) * G3;\r
    let X0 = f32(i) - t0;\r
    let Y0 = f32(j) - t0;\r
    let Z0 = f32(k) - t0;\r
\r
    var x0 = pos.x - X0;\r
    var y0 = pos.y - Y0;\r
    var z0 = pos.z - Z0;\r
\r
    // Determine which simplex we are in\r
    var i1: i32; var j1: i32; var k1: i32;\r
    var i2: i32; var j2: i32; var k2: i32;\r
    if (x0 >= y0) {\r
        if (y0 >= z0) {\r
            // X Y Z\r
            i1 = 1; j1 = 0; k1 = 0;\r
            i2 = 1; j2 = 1; k2 = 0;\r
        } else if (x0 >= z0) {\r
            // X Z Y\r
            i1 = 1; j1 = 0; k1 = 0;\r
            i2 = 1; j2 = 0; k2 = 1;\r
        } else {\r
            // Z X Y\r
            i1 = 0; j1 = 0; k1 = 1;\r
            i2 = 1; j2 = 0; k2 = 1;\r
        }\r
    } else {\r
        if (y0 < z0) {\r
            // Z Y X\r
            i1 = 0; j1 = 0; k1 = 1;\r
            i2 = 0; j2 = 1; k2 = 1;\r
        } else if (x0 < z0) {\r
            // Y Z X\r
            i1 = 0; j1 = 1; k1 = 0;\r
            i2 = 0; j2 = 1; k2 = 1;\r
        } else {\r
            // Y X Z\r
            i1 = 0; j1 = 1; k1 = 0;\r
            i2 = 1; j2 = 1; k2 = 0;\r
        }\r
    }\r
\r
    // Offsets for the other three corners\r
    let x1 = x0 - f32(i1) + G3;\r
    let y1 = y0 - f32(j1) + G3;\r
    let z1 = z0 - f32(k1) + G3;\r
\r
    let x2 = x0 - f32(i2) + 2.0 * G3;\r
    let y2 = y0 - f32(j2) + 2.0 * G3;\r
    let z2 = z0 - f32(k2) + 2.0 * G3;\r
\r
    let x3 = x0 - 1.0 + 3.0 * G3;\r
    let y3 = y0 - 1.0 + 3.0 * G3;\r
    let z3 = z0 - 1.0 + 3.0 * G3;\r
\r
    // Hash the corner indices to get gradient indices\r
    let ii = u32(i) & PERM_MASK;\r
    let jj = u32(j) & PERM_MASK;\r
    let kk = u32(k) & PERM_MASK;\r
\r
    let gi0 = perm(ii + perm(jj + perm(kk)))        % 12u;\r
    let gi1 = perm(ii + u32(i1) + perm((jj + u32(j1)) + perm((kk + u32(k1))))) % 12u;\r
    let gi2 = perm(ii + u32(i2) + perm((jj + u32(j2)) + perm((kk + u32(k2))))) % 12u;\r
    let gi3 = perm(ii + 1u      + perm((jj + 1u     ) + perm((kk + 1u     )))) % 12u;\r
\r
    // Compute contributions from each corner\r
    var n0: f32;\r
    var t_0 = 0.6 - x0*x0 - y0*y0 - z0*z0;\r
    if (t_0 < 0.0) {\r
        n0 = 0.0;\r
    } else {\r
        let t2 = t_0 * t_0;\r
        n0 = t2 * t2 * dot(gradient(gi0), vec3<f32>(x0, y0, z0));\r
    }\r
\r
    var n1: f32;\r
    var t_1 = 0.6 - x1*x1 - y1*y1 - z1*z1;\r
    if (t_1 < 0.0) {\r
        n1 = 0.0;\r
    } else {\r
        let t2 = t_1 * t_1;\r
        n1 = t2 * t2 * dot(gradient(gi1), vec3<f32>(x1, y1, z1));\r
    }\r
\r
    var n2: f32;\r
    var t_2 = 0.6 - x2*x2 - y2*y2 - z2*z2;\r
    if (t_2 < 0.0) {\r
        n2 = 0.0;\r
    } else {\r
        let t2 = t_2 * t_2;\r
        n2 = t2 * t2 * dot(gradient(gi2), vec3<f32>(x2, y2, z2));\r
    }\r
\r
    var n3: f32;\r
    var t_3 = 0.6 - x3*x3 - y3*y3 - z3*z3;\r
    if (t_3 < 0.0) {\r
        n3 = 0.0;\r
    } else {\r
        let t2 = t_3 * t_3;\r
        n3 = t2 * t2 * dot(gradient(gi3), vec3<f32>(x3, y3, z3));\r
    }\r
\r
    // Final scale to match [-1,1]\r
    return 32.0 * (n0 + n1 + n2 + n3);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  helpers  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
\r
fn cubicInterpolate(p0 : f32, p1 : f32, p2 : f32, p3 : f32, t : f32) -> f32 {\r
    return p1 + 0.5 * t *\r
        (p2 - p0 + t *\r
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t *\r
        (3.0 * (p1 - p2) + p3 - p0)));\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn lanczos2D(pos : vec2<f32>) -> f32 {\r
    let ix  : i32 = i32(floor(pos.x));\r
    let iy  : i32 = i32(floor(pos.y));\r
    let dx  : f32 = pos.x - f32(ix);\r
    let dy  : f32 = pos.y - f32(iy);\r
\r
    /* 4\xD74 neighbourhood hashed once \u2014 unrolled for speed */\r
    let n00 = rand2(ix - 1, iy - 1);\r
    let n10 = rand2(ix + 0, iy - 1);\r
    let n20 = rand2(ix + 1, iy - 1);\r
    let n30 = rand2(ix + 2, iy - 1);\r
\r
    let n01 = rand2(ix - 1, iy + 0);\r
    let n11 = rand2(ix + 0, iy + 0);\r
    let n21 = rand2(ix + 1, iy + 0);\r
    let n31 = rand2(ix + 2, iy + 0);\r
\r
    let n02 = rand2(ix - 1, iy + 1);\r
    let n12 = rand2(ix + 0, iy + 1);\r
    let n22 = rand2(ix + 1, iy + 1);\r
    let n32 = rand2(ix + 2, iy + 1);\r
\r
    let n03 = rand2(ix - 1, iy + 2);\r
    let n13 = rand2(ix + 0, iy + 2);\r
    let n23 = rand2(ix + 1, iy + 2);\r
    let n33 = rand2(ix + 2, iy + 2);\r
\r
    /* cubic along x (columns) */\r
    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);\r
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);\r
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);\r
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);\r
\r
    /* cubic along y (rows)  */\r
    return cubicInterpolate(col0, col1, col2, col3, dy);\r
}\r
\r
\r
/* helper to fetch one z-slice and cubic-interpolate along x/y */\r
fn slice(ix : i32, iy : i32, iz : i32, dx : f32, dy : f32) -> f32 {\r
    let n00 = rand3(ix - 1, iy - 1, iz);\r
    let n10 = rand3(ix + 0, iy - 1, iz);\r
    let n20 = rand3(ix + 1, iy - 1, iz);\r
    let n30 = rand3(ix + 2, iy - 1, iz);\r
\r
    let n01 = rand3(ix - 1, iy + 0, iz);\r
    let n11 = rand3(ix + 0, iy + 0, iz);\r
    let n21 = rand3(ix + 1, iy + 0, iz);\r
    let n31 = rand3(ix + 2, iy + 0, iz);\r
\r
    let n02 = rand3(ix - 1, iy + 1, iz);\r
    let n12 = rand3(ix + 0, iy + 1, iz);\r
    let n22 = rand3(ix + 1, iy + 1, iz);\r
    let n32 = rand3(ix + 2, iy + 1, iz);\r
\r
    let n03 = rand3(ix - 1, iy + 2, iz);\r
    let n13 = rand3(ix + 0, iy + 2, iz);\r
    let n23 = rand3(ix + 1, iy + 2, iz);\r
    let n33 = rand3(ix + 2, iy + 2, iz);\r
\r
    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);\r
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);\r
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);\r
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);\r
\r
    return cubicInterpolate(col0, col1, col2, col3, dy);\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn lanczos3D(pos : vec3<f32>) -> f32 {\r
    let ix : i32 = i32(floor(pos.x));\r
    let iy : i32 = i32(floor(pos.y));\r
    let iz : i32 = i32(floor(pos.z));\r
    let dx : f32 = pos.x - f32(ix);\r
    let dy : f32 = pos.y - f32(iy);\r
    let dz : f32 = pos.z - f32(iz);\r
\r
    /* 4\xD74\xD74 neighbourhood \u2014 fetch & interpolate on-the-fly */\r
\r
    let row0 = slice(ix, iy, iz - 1, dx, dy);\r
    let row1 = slice(ix, iy, iz + 0, dx, dy);\r
    let row2 = slice(ix, iy, iz + 1, dx, dy);\r
    let row3 = slice(ix, iy, iz + 2, dx, dy);\r
\r
    return cubicInterpolate(row0, row1, row2, row3, dz);\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn voronoi2D(pos : vec2<f32>) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
\r
    var minDist : f32 = 1e9;\r
    var minVal  : f32 = 0.0;\r
\r
    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
            let xi = fx + dx;\r
            let yi = fy + dy;\r
\r
            let px = f32(xi) + rand2u(xi, yi);\r
            let py = f32(yi) + rand2u(yi, xi);\r
\r
            let dist = (px - pos.x) * (px - pos.x) +\r
                       (py - pos.y) * (py - pos.y);\r
\r
            if (dist < minDist) {\r
                minDist = dist;\r
                minVal  = rand2u(xi, yi);\r
            }\r
        }\r
    }\r
    return minVal;          // in [0,1]\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
// fn voronoi3D(pos : vec3<f32>) -> f32 {\r
//     let fx : i32 = i32(floor(pos.x));\r
//     let fy : i32 = i32(floor(pos.y));\r
//     let fz : i32 = i32(floor(pos.z));\r
\r
//     var minDist : f32 = 1e9;\r
//     var minVal  : f32 = 0.0;\r
\r
//     for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {\r
//         for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
//             for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
//                 let xi = fx + dx;\r
//                 let yi = fy + dy;\r
//                 let zi = fz + dz;\r
\r
//                 let px = f32(xi) + rand3u(xi, yi, zi);\r
//                 let py = f32(yi) + rand3u(yi, zi, xi);\r
//                 let pz = f32(zi) + rand3u(zi, xi, yi);\r
\r
//                 let dist = (px - pos.x) * (px - pos.x) +\r
//                            (py - pos.y) * (py - pos.y) +\r
//                            (pz - pos.z) * (pz - pos.z);\r
\r
//                 if (dist < minDist) {\r
//                     minDist = dist;\r
//                     minVal  = rand3u(xi, yi, zi);\r
//                 }\r
//             }\r
//         }\r
//     }\r
//     return minVal;          // in [0,1]\r
// }\r
\r
\r
\r
// ----------------- types & mode constants -----------------\r
struct Voro3DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };\r
struct Voro4DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };\r
\r
// ----------------- voro_eval: pick output depending on mode -----------------\r
\r
\r
const VORO_CELL            : u32 = 0u;\r
const VORO_F1              : u32 = 1u;\r
const VORO_INTERIOR        : u32 = 2u;  // gap = F2 - F1\r
const VORO_EDGES           : u32 = 3u;  // scaled gap\r
const VORO_EDGE_THRESH     : u32 = 4u;  // gate gap >= threshold\r
const VORO_FLAT_SHADE      : u32 = 5u;  // interior = 1, edges = 0 (edges defined by gap < threshold)\r
const VORO_FLAT_SHADE_INV  : u32 = 6u;  // edges = 1, interior = 0 (gap < threshold)\r
\r
// Added: "old cellular3D" compatible squared-gap modes (F2^2 - F1^2)\r
const VORO_INTERIOR_SQ        : u32 = 7u;  // gapSq = F2^2 - F1^2\r
const VORO_EDGES_SQ           : u32 = 8u;  // scaled gapSq\r
const VORO_EDGE_THRESH_SQ     : u32 = 9u;  // gate gapSq >= threshold\r
const VORO_FLAT_SHADE_SQ      : u32 = 10u; // interior = 1, edges = 0 (gapSq < threshold)\r
const VORO_FLAT_SHADE_INV_SQ  : u32 = 11u; // edges = 1, interior = 0 (gapSq < threshold)\r
\r
// Added: F1 threshold and masks (useful for "radius" gates, bubble masks, etc.)\r
const VORO_F1_THRESH      : u32 = 12u; // gate F1 >= threshold, returns F1 * gate\r
const VORO_F1_MASK        : u32 = 13u; // smooth mask: 0 below threshold, 1 above (feather=edgeK)\r
const VORO_F1_MASK_INV    : u32 = 14u; // inverted mask: 1 below threshold, 0 above (feather=edgeK)\r
\r
// Added: softer edge line response (no threshold needed)\r
const VORO_EDGE_RCP       : u32 = 15u; // 1 / (1 + gap*k)\r
const VORO_EDGE_RCP_SQ    : u32 = 16u; // 1 / (1 + gapSq*k)\r
\r
fn voro_edge_dist(f1Sq: f32, f2Sq: f32) -> f32 {\r
  let f1 = sqrt(max(f1Sq, 0.0));\r
  let f2 = sqrt(max(f2Sq, 0.0));\r
  return max(f2 - f1, 0.0);\r
}\r
\r
// edgeDist is gap (or gapSq for *_SQ modes)\r
// returns 1 near edges (small edgeDist), 0 in interior\r
fn voro_edge_mask(edgeDist: f32, threshold: f32, feather: f32) -> f32 {\r
  let t = max(threshold, 0.0);\r
  if (t <= 0.0) { return 0.0; }\r
\r
  let f = max(feather, 0.0);\r
  if (f > 0.0) {\r
    return 1.0 - smoothstep(t, t + f, edgeDist);\r
  }\r
  return select(0.0, 1.0, edgeDist < t);\r
}\r
\r
// returns 0 below threshold, 1 above (optionally smoothed)\r
fn voro_thresh_mask(v: f32, threshold: f32, feather: f32) -> f32 {\r
  let t = max(threshold, 0.0);\r
  if (t <= 0.0) { return 0.0; }\r
\r
  let f = max(feather, 0.0);\r
  if (f > 0.0) {\r
    return smoothstep(t, t + f, v);\r
  }\r
  return select(0.0, 1.0, v >= t);\r
}\r
\r
\r
// f1Sq/f2Sq are squared distances; cellVal in [0,1].\r
// edgeK is scale (edges modes) or feather (mask modes). freqOrScale unused.\r
fn voro_eval(\r
  f1Sq: f32,\r
  f2Sq: f32,\r
  cellVal: f32,\r
  mode: u32,\r
  edgeK: f32,\r
  threshold: f32,\r
  freqOrScale: f32\r
) -> f32 {\r
  let f1 = sqrt(max(f1Sq, 0.0));\r
  let f2 = sqrt(max(f2Sq, 0.0));\r
  let gap = max(f2 - f1, 0.0);\r
\r
  let gapSq = max(f2Sq - f1Sq, 0.0);\r
\r
  switch (mode) {\r
    case VORO_CELL: {\r
      return cellVal;\r
    }\r
    case VORO_F1: {\r
      return f1;\r
    }\r
    case VORO_INTERIOR: {\r
      return gap;\r
    }\r
    case VORO_EDGES: {\r
      let k = max(edgeK, 0.0);\r
      return clamp(gap * select(10.0, k, k > 0.0), 0.0, 1.0);\r
    }\r
    case VORO_EDGE_THRESH: {\r
      let t = max(threshold, 0.0);\r
      let gate = select(0.0, 1.0, gap >= t);\r
      return gap * gate;\r
    }\r
    case VORO_FLAT_SHADE: {\r
      let edge = voro_edge_mask(gap, threshold, edgeK);\r
      return 1.0 - edge;\r
    }\r
    case VORO_FLAT_SHADE_INV: {\r
      let edge = voro_edge_mask(gap, threshold, edgeK);\r
      return edge;\r
    }\r
\r
    case VORO_INTERIOR_SQ: {\r
      return gapSq;\r
    }\r
    case VORO_EDGES_SQ: {\r
      let k = max(edgeK, 0.0);\r
      return clamp(gapSq * select(10.0, k, k > 0.0), 0.0, 1.0);\r
    }\r
    case VORO_EDGE_THRESH_SQ: {\r
      let t = max(threshold, 0.0);\r
      let gate = select(0.0, 1.0, gapSq >= t);\r
      return gapSq * gate;\r
    }\r
    case VORO_FLAT_SHADE_SQ: {\r
      let edge = voro_edge_mask(gapSq, threshold, edgeK);\r
      return 1.0 - edge;\r
    }\r
    case VORO_FLAT_SHADE_INV_SQ: {\r
      let edge = voro_edge_mask(gapSq, threshold, edgeK);\r
      return edge;\r
    }\r
\r
    case VORO_F1_THRESH: {\r
      let t = max(threshold, 0.0);\r
      let gate = select(0.0, 1.0, f1 >= t);\r
      return f1 * gate;\r
    }\r
    case VORO_F1_MASK: {\r
      return voro_thresh_mask(f1, threshold, edgeK);\r
    }\r
    case VORO_F1_MASK_INV: {\r
      return 1.0 - voro_thresh_mask(f1, threshold, edgeK);\r
    }\r
\r
    case VORO_EDGE_RCP: {\r
      let k = max(edgeK, 0.0);\r
      return 1.0 / (1.0 + gap * k*10);\r
    }\r
    case VORO_EDGE_RCP_SQ: {\r
      let k = max(edgeK, 0.0);\r
      return 1.0 / (1.0 + gapSq * k*10);\r
    }\r
\r
    default: {\r
      return gap;\r
    }\r
  }\r
}\r
\r
// ----------------- helpers: metrics -----------------\r
fn voro3D_metrics(pos: vec3<f32>) -> Voro3DMetrics {\r
  let fx = i32(floor(pos.x));\r
  let fy = i32(floor(pos.y));\r
  let fz = i32(floor(pos.z));\r
\r
  var d1 : f32 = 1e9;\r
  var d2 : f32 = 1e9;\r
  var lab: f32 = 0.0;\r
\r
  for (var dz = -1; dz <= 1; dz = dz + 1) {\r
    for (var dy = -1; dy <= 1; dy = dy + 1) {\r
      for (var dx = -1; dx <= 1; dx = dx + 1) {\r
        let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;\r
\r
        let rx = rand3u(xi, yi, zi);\r
        let ry = rand3u(yi, zi, xi);\r
        let rz = rand3u(zi, xi, yi);\r
\r
        let px = f32(xi) + rx;\r
        let py = f32(yi) + ry;\r
        let pz = f32(zi) + rz;\r
\r
        let dxv = px - pos.x;\r
        let dyv = py - pos.y;\r
        let dzv = pz - pos.z;\r
\r
        let d2c = dxv*dxv + dyv*dyv + dzv*dzv;\r
\r
        if (d2c < d1) {\r
          d2 = d1;\r
          d1 = d2c;\r
          lab = rand3u(xi, yi, zi);\r
        } else if (d2c < d2) {\r
          d2 = d2c;\r
        }\r
      }\r
    }\r
  }\r
  return Voro3DMetrics(d1, d2, lab);\r
}\r
\r
fn voro4D_metrics(p: vec4<f32>) -> Voro4DMetrics {\r
  let fx = i32(floor(p.x));\r
  let fy = i32(floor(p.y));\r
  let fz = i32(floor(p.z));\r
  let fw = i32(floor(p.w));\r
\r
  var d1 : f32 = 1e9;\r
  var d2 : f32 = 1e9;\r
  var lab: f32 = 0.0;\r
\r
  for (var dw = -1; dw <= 1; dw = dw + 1) {\r
    for (var dz = -1; dz <= 1; dz = dz + 1) {\r
      for (var dy = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx = -1; dx <= 1; dx = dx + 1) {\r
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz; let wi = fw + dw;\r
\r
          let rx = rand4u(xi, yi, zi, wi);\r
          let ry = rand4u(yi, zi, wi, xi);\r
          let rz = rand4u(zi, wi, xi, yi);\r
          let rw = rand4u(wi, xi, yi, zi);\r
\r
          let px = f32(xi) + rx;\r
          let py = f32(yi) + ry;\r
          let pz = f32(zi) + rz;\r
          let pw = f32(wi) + rw;\r
\r
          let dxv = px - p.x; let dyv = py - p.y;\r
          let dzv = pz - p.z; let dwv = pw - p.w;\r
\r
          let d2c = dxv*dxv + dyv*dyv + dzv*dzv + dwv*dwv;\r
\r
          if (d2c < d1) {\r
            d2 = d1;\r
            d1 = d2c;\r
            lab = rand4u(xi, yi, zi, wi);\r
          } else if (d2c < d2) {\r
            d2 = d2c;\r
          }\r
        }\r
      }\r
    }\r
  }\r
  return Voro4DMetrics(d1, d2, lab);\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Cellular 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn cellular2D(pos : vec2<f32>) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
\r
    var minDist1 : f32 = 1e9;\r
    var minDist2 : f32 = 1e9;\r
\r
    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
            let xi = fx + dx;\r
            let yi = fy + dy;\r
\r
            /* feature point */\r
            let px = f32(xi) + rand2u(xi, yi);\r
            let py = f32(yi) + rand2u(yi, xi);\r
\r
            /* squared distance */\r
            let d = (px - pos.x) * (px - pos.x)\r
                  + (py - pos.y) * (py - pos.y);\r
\r
            /* keep two smallest distances */\r
            if (d < minDist1) {\r
                minDist2 = minDist1;\r
                minDist1 = d;\r
            } else if (d < minDist2) {\r
                minDist2 = d;\r
            }\r
        }\r
    }\r
    /* return difference of 1st and 2nd nearest feature distances */\r
    return minDist2 - minDist1;\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Worley 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn worley2D(pos : vec2<f32>) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
\r
    var minDist : f32 = 1e9;\r
\r
    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
            let xi = fx + dx;\r
            let yi = fy + dy;\r
\r
            /* feature point */\r
            let px = f32(xi) + rand2u(xi, yi);\r
            let py = f32(yi) + rand2u(yi, xi);\r
\r
            /* squared distance */\r
            let d = (px - pos.x) * (px - pos.x)\r
                  + (py - pos.y) * (py - pos.y);\r
\r
            if (d < minDist) {\r
                minDist = d;\r
            }\r
        }\r
    }\r
\r
    return sqrt(minDist);    // Euclidean distance to nearest feature\r
}\r
\r
/* central-diff gradient of scalar simplex */\r
fn gradSimplex2(q: vec2<f32>, eps: f32) -> vec2<f32> {\r
  let dx = (simplex2D(q + vec2<f32>(eps, 0.0)) - simplex2D(q - vec2<f32>(eps, 0.0))) / (2.0 * eps);\r
  let dy = (simplex2D(q + vec2<f32>(0.0, eps)) - simplex2D(q - vec2<f32>(0.0, eps))) / (2.0 * eps);\r
  return vec2<f32>(dx, dy);\r
}\r
\r
/* single-octave curl = grad rotated 90\xB0 (\u2202N/\u2202y, -\u2202N/\u2202x) */\r
fn curl2_simplex2D(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {\r
  let q = (pos / p.zoom) * p.freq + vec2<f32>(p.xShift, p.yShift);\r
\r
  // choose \u03B5 ~ half a cycle of current scale to avoid lattice aliasing\r
  let cycles_per_world = max(p.freq / max(p.zoom, 1e-6), 1e-6);\r
  let eps = 0.5 / cycles_per_world;\r
\r
  let g = gradSimplex2(q, eps);\r
  return vec2<f32>(g.y, -g.x);\r
}\r
\r
/* multi-octave curl: sum derivatives per octave (no sharp creases) */\r
fn curl2_simplexFBM(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {\r
  var q      = (pos / p.zoom) * p.freq + vec2<f32>(p.xShift, p.yShift);\r
  var freq   : f32 = p.freq;\r
  var amp    : f32 = 1.0;\r
  var angle  : f32 = p.seedAngle;\r
  var curl   : vec2<f32> = vec2<f32>(0.0);\r
\r
  for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
    // \u03B5 scales with octave so the finite difference stays well-conditioned\r
    let cycles_per_world = max(freq / max(p.zoom, 1e-6), 1e-6);\r
    let eps = 0.5 / cycles_per_world;\r
\r
    let g = gradSimplex2(q * freq, eps * freq);\r
    curl += vec2<f32>(g.y, -g.x) * amp;\r
\r
    // next octave\r
    freq *= p.lacunarity;\r
    amp  *= p.gain;\r
\r
    // decorrelate like your Perlin path (XY rotate + shift bleed into next)\r
    let cA = cos(angle);\r
    let sA = sin(angle);\r
    let nx = q.x * cA - q.y * sA;\r
    let ny = q.x * sA + q.y * cA;\r
    q = vec2<f32>(nx, ny) + vec2<f32>(p.xShift, p.yShift);\r
    angle += ANGLE_INCREMENT;\r
  }\r
  return curl;\r
}\r
\r
/* map a non-negative magnitude to [-1,1] for your writeChannel convention */\r
fn mag_to_signed01(m: f32) -> f32 {\r
  return clamp(m, 0.0, 1.0) * 2.0 - 1.0;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn domainWarpFBM(p: vec3<f32>, params: NoiseParams,\r
                 warpAmp: f32, stages: u32) -> f32 {\r
    var q = p;\r
    for (var i: u32 = 0u; i < stages; i = i + 1u) {\r
        let w = fbm3D(q, params) * warpAmp;\r
        q = q + vec3<f32>(w, w, w);\r
    }\r
    return fbm3D(q, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 gabor utils \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
\r
const TAU : f32 = 6.283185307179586;\r
\r
fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }\r
\r
fn hash_u32(x: u32) -> u32 {\r
  var v = x;\r
  v = (v ^ 61u) ^ (v >> 16u);\r
  v = v + (v << 3u);\r
  v = v ^ (v >> 4u);\r
  v = v * 0x27d4eb2du;\r
  v = v ^ (v >> 15u);\r
  return v;\r
}\r
\r
fn hash3_u32(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> u32 {\r
  let x = u32(ix) * 73856093u;\r
  let y = u32(iy) * 19349663u;\r
  let z = u32(iz) * 83492791u;\r
  return hash_u32(x ^ y ^ z ^ seed ^ salt);\r
}\r
\r
fn rnd01(h: u32) -> f32 {\r
  return f32(h) * (1.0 / 4294967295.0);\r
}\r
\r
fn rand3_01(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> f32 {\r
  return rnd01(hash3_u32(ix, iy, iz, seed, salt));\r
}\r
\r
fn rand3_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {\r
  let a = rand3_01(ix, iy, iz, seed, salt + 0u);\r
  let b = rand3_01(ix, iy, iz, seed, salt + 1u);\r
  let c = rand3_01(ix, iy, iz, seed, salt + 2u);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
fn rand_unit_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {\r
  let u = rand3_01(ix, iy, iz, seed, salt + 0u);\r
  let v = rand3_01(ix, iy, iz, seed, salt + 1u);\r
\r
  let z = 1.0 - 2.0 * u;\r
  let r = sqrt(max(0.0, 1.0 - z * z));\r
  let a = TAU * v;\r
\r
  return vec3<f32>(r * cos(a), r * sin(a), z);\r
}\r
\r
fn gabor_kernel3D(d: vec3<f32>, dir: vec3<f32>, waveFreq: f32, sigma: f32, phase: f32) -> f32 {\r
  let s  = max(0.0005, sigma);\r
  let g  = exp(-dot(d, d) / (2.0 * s * s));\r
  let w  = cos(TAU * waveFreq * dot(dir, d) + phase);\r
  return g * w;\r
}\r
\r
fn gaborWarpDomain(p: vec3<f32>, params: NoiseParams) -> vec3<f32> {\r
  let a = params.warpAmp;\r
  if (a <= 0.00001) { return p; }\r
\r
  let w1 = simplex3D(p * 0.75 + vec3<f32>(13.1, 7.7, 19.3));\r
  let w2 = simplex3D(p * 0.75 + vec3<f32>(41.7, 23.9, 5.3));\r
  let w3 = simplex3D(p * 0.75 + vec3<f32>(9.9, 31.3, 17.7));\r
\r
  return p + vec3<f32>(w1, w2, w3) * a;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Gabor sparse-convolution  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn gaborOctave3D(p: vec3<f32>, waveFreq: f32, sigma: f32, params: NoiseParams) -> f32 {\r
  let base = vec3<i32>(\r
    i32(floor(p.x)),\r
    i32(floor(p.y)),\r
    i32(floor(p.z))\r
  );\r
\r
  var sum: f32 = 0.0;\r
\r
  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
        let cx = base.x + dx;\r
        let cy = base.y + dy;\r
        let cz = base.z + dz;\r
\r
        let jitter = rand3_vec3(cx, cy, cz, params.seed, 11u) - vec3<f32>(0.5, 0.5, 0.5);\r
        let center = vec3<f32>(f32(cx), f32(cy), f32(cz)) + vec3<f32>(0.5, 0.5, 0.5) + jitter * 0.95;\r
\r
        let d     = p - center;\r
        let dir   = rand_unit_vec3(cx, cy, cz, params.seed, 41u);\r
        let phase = TAU * rand3_01(cx, cy, cz, params.seed, 71u);\r
        let amp   = rand3_01(cx, cy, cz, params.seed, 91u) * 2.0 - 1.0;\r
\r
        sum += amp * gabor_kernel3D(d, dir, waveFreq, sigma, phase);\r
      }\r
    }\r
  }\r
\r
  return sum * (1.0 / 9.0);\r
}\r
\r
fn gaborShape(n: f32, params: NoiseParams) -> f32 {\r
  var v = 0.5 + 0.5 * clamp(n, -1.0, 1.0);\r
\r
  let widen = max(0.0, params.gaborRadius) * max(0.0001, params.exp2);\r
  v = pow(saturate(v), 1.0 / (1.0 + widen));\r
\r
  let t    = saturate(params.threshold);\r
  let hard = max(0.0001, params.exp1);\r
\r
  let a = smoothstep(t - hard, t + hard, v);\r
  return a * 2.0 - 1.0;\r
}\r
\r
/* Multi-octave Gabor with the same rotate/shift cadence as Perlin */\r
fn gaborNoise3D(p: vec3<f32>, params: NoiseParams) -> f32 {\r
  var x = p.x / params.zoom + params.xShift;\r
  var y = p.y / params.zoom + params.yShift;\r
  var z = p.z / params.zoom + params.zShift;\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = params.freq;\r
  var angle   : f32 = params.seedAngle;\r
\r
  let waveFreq = max(0.001, params.rippleFreq);\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let sigma = max(0.0005, params.gaborRadius);\r
\r
    var pp = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);\r
    pp = gaborWarpDomain(pp, params);\r
\r
    var n = gaborOctave3D(pp, waveFreq, sigma, params);\r
\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    sum += n * amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
    let c  = cos(angle);\r
    let s  = sin(angle);\r
    let nx = x * c - y * s;\r
    let ny = x * s + y * c;\r
    let nz = y * s + z * c;\r
\r
    x = nx + params.xShift;\r
    y = ny + params.yShift;\r
    z = nz + params.zShift;\r
\r
    angle += ANGLE_INCREMENT;\r
  }\r
\r
  var out = gaborShape(sum, params);\r
  if (params.turbulence == 1u) { out = out - 1.0; }\r
  return out;\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Terrace & Foam filters  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn terrace(v:f32, steps:f32)  -> f32 { return floor(v*steps)/steps; }\r
fn foamify(v:f32)             -> f32 { return pow(abs(v), 3.0)*sign(v); }\r
fn turbulence(v:f32)          -> f32 { return abs(v); }\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Simplex (multi-octave) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn generateSimplex(pos: vec3<f32>, p: NoiseParams) -> f32 {\r
    // start coords (zoom/freq/shift)\r
    var x = pos.x / p.zoom * p.freq + p.xShift;\r
    var y = pos.y / p.zoom * p.freq + p.yShift;\r
    var z = pos.z / p.zoom * p.freq + p.zShift;\r
\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = p.freq;\r
    var angle   : f32 = p.seedAngle;\r
\r
    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
        var n = simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        if (p.turbulence == 1u) { n = abs(n); }\r
        sum += n * amp;\r
\r
        // advance octave\r
        freqLoc *= p.lacunarity;\r
        amp     *= p.gain;\r
\r
        // rotate in XY and bleed into Z \u2014 matches your Perlin cadence\r
        let c  = cos(angle);\r
        let s  = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = y * s + z * c;\r
\r
        x = nx + p.xShift;\r
        y = ny + p.yShift;\r
        z = nz + p.zShift;\r
\r
        angle += ANGLE_INCREMENT;\r
    }\r
\r
    if (p.turbulence == 1u) { sum -= 1.0; }\r
    return sum;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex-based fBm helper (normalized)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn sfbm3D(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = (pos.x + params.xShift) / params.zoom;\r
    var y = (pos.y + params.yShift) / params.zoom;\r
    var z = (pos.z + params.zShift) / params.zoom;\r
\r
    var sum       : f32 = 0.0;\r
    var amplitude : f32 = 1.0;\r
    var maxValue  : f32 = 0.0;\r
    var freqLoc   : f32 = params.freq;\r
\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n = simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        if (params.turbulence == 1u) { n = abs(n); }\r
\r
        sum      += amplitude * n;\r
        maxValue += amplitude;\r
\r
        freqLoc   *= params.lacunarity;\r
        amplitude *= params.gain;\r
\r
        // rotate & shift per octave (keeps look consistent with Perlin FBM)\r
        angle += angleInc;\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = y * s + z * c;\r
        x = nx + params.xShift;\r
        y = ny + params.yShift;\r
        z = nz + params.zShift;\r
    }\r
\r
    if (maxValue > 0.0) {\r
        return sum / maxValue;\r
    }\r
    return 0.0;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex FBM (Perlin-style nested fBm)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn generateSimplexFBM(pos: vec3<f32>, p: NoiseParams) -> f32 {\r
    // Same  you use for Perlin FBM: fBm once, then feed through again\r
    let fbm1 = sfbm3D(pos, p);\r
    let fbm2 = sfbm3D(vec3<f32>(fbm1, fbm1, fbm1), p);\r
    return 2.0 * fbm2;  // keep roughly in [-1,1]\r
}\r
\r
fn generateDomainWarpFBM1(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let v = domainWarpFBM(pos, par, par.warpAmp, 1u);\r
    return v;\r
}\r
\r
fn generateDomainWarpFBM2(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let v = domainWarpFBM(pos, par, par.warpAmp, 2u);\r
    return v;\r
}\r
\r
fn generateGaborAniso(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let v = gaborNoise3D(pos, par);\r
    return v;\r
}\r
\r
fn generateTerraceNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let base = generatePerlin(pos, par);\r
    let v = terrace(base, par.terraceStep);\r
    return v;\r
}\r
\r
fn generateFoamNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let base = generateBillow(pos, par);\r
    let v = foamify(base);\r
    return v;\r
}\r
\r
fn generateTurbulence(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let base = generatePerlin(pos, par);\r
    let v = turbulence(base);\r
    return v;\r
}\r
\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Perlin Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generatePerlin(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // initial coords scaled by zoom\r
    var x = pos.x / params.zoom * params.freq + params.xShift;\r
    var y = pos.y / params.zoom * params.freq + params.yShift;\r
    var z = pos.z / params.zoom * params.freq + params.zShift;\r
\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
    var angle : f32 = params.seedAngle;\r
\r
    // accumulate octaves\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        // sample base noise\r
        var n : f32 = noise3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;\r
        // optional billow / turbulence\r
        if (params.turbulence == 1u) {\r
            n = abs(n);\r
        }\r
        sum = sum + n;\r
\r
        // update frequency & amplitude\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
\r
        // rotate coords in XY plane + push into Z\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = y * s + z * c;\r
\r
        // apply shifts\r
        x = nx + params.xShift;\r
        y = ny + params.yShift;\r
        z = nz + params.zShift;\r
\r
        // increment angle\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    // final tweak for turbulence mode\r
    if (params.turbulence == 1u) {\r
        sum = sum - 1.0;\r
    }\r
    return sum;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Perlin FBM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generatePerlin4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  // Prepare base coords + starting frequency\r
  var base    : vec4<f32>;\r
  var freqLoc : f32;\r
\r
  if (params.toroidal == 1u) {\r
    // pos = (U,V,\u03B8); HTML-style: apply zoom outside the octave loop\r
    base    = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
    freqLoc = params.freq;                 // (freq/zoom) == (base/zoom * freq)\r
  } else {\r
    // original non-toroidal semantics (note: freq is baked in before the loop)\r
    base = vec4<f32>(\r
      pos.x / zoom * params.freq + params.xShift,\r
      pos.y / zoom * params.freq + params.yShift,\r
      pos.z / zoom * params.freq + params.zShift,\r
      params.time\r
    );\r
    freqLoc = params.freq;\r
  }\r
\r
  var sum   : f32 = 0.0;\r
  var amp   : f32 = 1.0;\r
  var angle : f32 = params.seedAngle;\r
\r
  // Shared octave loop\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    var n = noise4D(base * freqLoc) * amp;\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    sum += n;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
    // Only the non-toroidal path uses octave rotation/offset churn\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>( base.x * c - base.y * s, base.x * s + base.y * c );\r
      let zw = vec2<f32>( base.z * c - base.w * s, base.z * s + base.w * c );\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  if (params.turbulence == 1u) { sum -= 1.0; }\r
  return sum;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    // Base domain mapping\r
    var p = (pos / params.zoom) * params.freq\r
          + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
\r
    var sum: f32     = 0.0;\r
    var amp: f32     = 1.0;\r
    var freqLoc: f32 = 1.0;          // start at base; multiply by lacunarity each octave\r
    var ampSum: f32  = 0.0;\r
    var angle: f32   = params.seedAngle;\r
\r
    // Octave stack\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        // Billow core: absolute value of gradient noise\r
        let n  = noise3D(p * freqLoc);\r
        let b  = pow(abs(n), 0.75);   // gentle gamma (<1) puffs the domes\r
        sum    = sum + b * amp;\r
        ampSum = ampSum + amp;\r
\r
        // Advance octave\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
\r
        // Cheap domain rotation (XY) + tiny Z drift to break symmetry\r
        let c  = cos(angle);\r
        let s  = sin(angle);\r
        let xy = vec2<f32>(p.x, p.y);\r
        let r  = vec2<f32>(xy.x * c - xy.y * s, xy.x * s + xy.y * c);\r
        p = vec3<f32>(r.x, r.y, p.z + 0.03125);   // small constant drift\r
\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    // Normalize to [0,1]\r
    if (ampSum > 0.0) {\r
        sum = sum / ampSum;\r
    }\r
\r
    // Mild contrast curve around 0.5 so domes pop without creating ridge-like creases\r
    let k: f32 = 1.2;                // 1.0 = linear; >1 increases local contrast\r
    let cMid   = sum - 0.5;\r
    let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));\r
\r
    return clamp(shaped, 0.0, 1.0);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti-Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    return 1.0 - generateBillow(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// basic ridge transform of gradient noise\r
fn ridgeNoise(pos : vec3<f32>) -> f32 {\r
    let v = noise3D(pos);\r
    let w = 1.0 - abs(v);\r
    return w * w;\r
}\r
\r
// octave\u2010sum generator using ridge noise\r
// sample like: let r = generateRidge(vec3<f32>(x,y,z));\r
fn generateRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    var x = pos.x / params.zoom * params.freq + params.xShift;\r
    var y = pos.y / params.zoom * params.freq + params.yShift;\r
    var z = pos.z / params.zoom * params.freq + params.zShift;\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        sum = sum + ridgeNoise(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
        x = x + params.xShift;\r
        y = y + params.yShift;\r
        z = z + params.zShift;\r
    }\r
\r
    // JS did: sum -= 1; return -sum;\r
    sum = sum - 1.0;\r
    return -sum;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// identical ridge transform, but flips sign at output\r
fn generateAntiRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // reuse generateRidge and negate its result\r
    return -generateRidge(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise (Fast Lanczos) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // initial coords: zoom + freq\r
    var x = pos.x / params.zoom * params.freq + params.xShift;\r
    var y = pos.y / params.zoom * params.freq + params.yShift;\r
    var z = pos.z / params.zoom * params.freq + params.zShift;\r
\r
    // first octave\r
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));\r
    var amp : f32 = 1.0;\r
\r
    // subsequent octaves\r
    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {\r
        x = x * params.lacunarity;\r
        y = y * params.lacunarity;\r
        z = z * params.lacunarity;\r
        amp = amp * params.gain;\r
\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum - n * amp;\r
\r
        x = x + params.xShift;\r
        y = y + params.yShift;\r
        z = z + params.zShift;\r
    }\r
\r
    return sum;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 2 (Fast Lanczos + Rotation) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // zoom + freq\r
    var x = (pos.x + params.xShift) / params.zoom * params.freq;\r
    var y = (pos.y + params.yShift) / params.zoom * params.freq;\r
    var z = (pos.z + params.zShift) / params.zoom * params.freq;\r
\r
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));\r
    var amp : f32 = 1.0;\r
    var angle : f32 = params.seedAngle;\r
\r
    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {\r
        x = x * params.lacunarity;\r
        y = y * params.lacunarity;\r
        z = z * params.lacunarity;\r
        amp = amp * params.gain;\r
\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum - n * amp;\r
\r
        // proper 2D rotation around Z:\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = z;\r
\r
        x = nx + params.xShift;\r
        y = ny + params.yShift;\r
        z = nz + params.zShift;\r
\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    return sum;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // zoom + freq\r
    var x = (pos.x + params.xShift) / params.zoom * params.freq;\r
    var y = (pos.y + params.yShift) / params.zoom * params.freq;\r
    var z = (pos.z + params.zShift) / params.zoom * params.freq;\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
\r
    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n : f32 = lanczos3D(vec3<f32>(x, y, z));\r
        n = max(1e-7, n + 1.0);\r
        n = 2.0 * pow(n * 0.5, params.exp2+1.5) - 1.0;\r
        n = 1.0 - abs(n);\r
        if (params.exp1 - 1.0 != 0.0) {\r
            n = 1.0 - pow(n, params.exp1 - 1.0);\r
        }\r
\r
        sum = sum + n * amp;\r
\r
        x = x * params.lacunarity + params.xShift;\r
        y = y * params.lacunarity + params.yShift;\r
        z = z * params.lacunarity + params.zShift;\r
        amp = amp * params.gain;\r
    }\r
\r
    return sum - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    var x = (pos.x + params.xShift) / params.zoom * params.freq;\r
    var y = (pos.y + params.yShift) / params.zoom * params.freq;\r
    var z = (pos.z + params.zShift) / params.zoom * params.freq;\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
\r
    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum + n * amp;\r
\r
        x = x * params.lacunarity + params.xShift;\r
        y = y * params.lacunarity + params.yShift;\r
        z = z * params.lacunarity + params.zShift;\r
        amp = amp * params.gain;\r
    }\r
\r
    return sum - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal2(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal3(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal4(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fractal Brownian Motion (3D Simplex) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
\r
// 3-D FBM helper: sums octaves of simplex noise with rotating shifts\r
fn fbm3D(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // apply zoom\r
    var x       = (pos.x + params.xShift) / params.zoom;\r
    var y       = (pos.y + params.yShift) / params.zoom;\r
    var z       = (pos.z + params.zShift) / params.zoom;\r
    var sum       : f32 = 0.0;\r
    var amplitude : f32 = 1.0;\r
    var maxValue  : f32 = 0.0;\r
    var freqLoc   : f32 = params.freq;\r
    // start angle from uniform seedAngle\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        // accumulate weighted noise\r
        sum = sum + amplitude * simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        maxValue = maxValue + amplitude;\r
\r
        // next freq & amp\r
        freqLoc   = freqLoc * params.lacunarity;\r
        amplitude = amplitude * params.gain;\r
\r
        // advance rotation\r
        angle = angle + angleInc;\r
        let offX = params.xShift * cos(angle);\r
        let offY = params.yShift * cos(angle);\r
        let offZ = params.zShift * cos(angle);\r
\r
        // apply shift\r
        x = x + offX;\r
        y = y + offY;\r
        z = z + offZ;\r
    }\r
    // normalize\r
    return sum / maxValue;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// two\u2010stage fbm, then doubled\r
fn generateFBM(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    let fbm1 = fbm3D(pos, params);\r
    let fbm2 = fbm3D(vec3<f32>(fbm1, fbm1, fbm1), params);\r
    return 2.0 * fbm2;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// chained fbm with scaling by zoom\r
fn generateFBM2(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    let fbm1 = fbm3D(pos, params);\r
    let s    = params.zoom;\r
    let fbm2 = fbm3D(vec3<f32>(fbm1 * s, fbm1 * s, fbm1 * s), params);\r
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,\r
                               pos.y + fbm2 * s,\r
                               pos.z + fbm2 * s), params);\r
    return 2.0 * fbm3;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// three\u2010step chaining of fbm with offset\r
fn generateFBM3(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    let fbm1 = fbm3D(pos, params);\r
    let s    = params.zoom;\r
    let fbm2 = fbm3D(vec3<f32>(pos.x + fbm1 * s,\r
                               pos.y + fbm1 * s,\r
                               pos.z + fbm1 * s), params);\r
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,\r
                               pos.y + fbm2 * s,\r
                               pos.z + fbm2 * s), params);\r
    return 2.0 * fbm3;\r
}\r
\r
/*==============================================================================\r
  Cellular Brownian-Motion FBM helpers & generators\r
==============================================================================*/\r
\r
fn edgeCut(val: f32, threshold: f32) -> f32 {\r
  // return 0.0 when val < threshold, otherwise return val\r
  return select(val, 0.0, val < threshold);\r
}\r
\r
// 3-D Cellular FBM helper: sums octaves of cellular3D with rotating shifts\r
fn fbmCellular3D(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    var x = (pos.x + params.xShift) / params.zoom;\r
    var y = (pos.y + params.yShift) / params.zoom;\r
    var z = (pos.z + params.zShift) / params.zoom;\r
\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
\r
    var angle   : f32 = params.seedAngle;\r
    let angleInc: f32 = 2.0 * PI / f32(params.octaves);\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let n = edgeCut(cellular3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)),\r
                        params.threshold);\r
        sum = sum + amp * n;\r
\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
\r
        angle = angle + angleInc;\r
        let offX = params.xShift * cos(angle);\r
        let offY = params.yShift * cos(angle);\r
        let offZ = params.zShift * cos(angle);\r
\r
        x = x + offX;\r
        y = y + offY;\r
        z = z + offZ;\r
    }\r
    return sum;\r
}\r
\r
/* ---- Three cellular FBM flavours ---------------------------------------- */\r
fn generateCellularBM1(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    let f1 = fbmCellular3D(pos, params);\r
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);\r
    return 1.5 * f2 - 1.0;\r
}\r
\r
fn generateCellularBM2(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    let f1 = fbmCellular3D(pos, params);\r
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);\r
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);\r
    return 1.5 * f3 - 1.0;\r
}\r
\r
fn generateCellularBM3(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    let f1 = fbmCellular3D(pos, params);\r
    let f2 = fbmCellular3D(vec3<f32>(pos + f1 * params.zoom), params);\r
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);\r
    return 1.5 * f3 - 1.0;\r
}\r
\r
/* ---- Voronoi and Voronoi Brownian-Motion flavours ---------------------------------- */\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Voronoi Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateVoronoi4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var freqLoc: f32 = params.freq / zoom;\r
\r
  let mode: u32 = params.voroMode;\r
  let edgeK: f32 = max(params.edgeK, 0.0);\r
  let threshold: f32 = max(params.threshold, 0.0);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time);\r
  } else {\r
    base = vec4<f32>(\r
      (pos.x + params.xShift) / zoom,\r
      (pos.y + params.yShift) / zoom,\r
      (pos.z + params.zShift) / zoom,\r
      params.time\r
    );\r
  }\r
\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let P = base * freqLoc;\r
    let m = voro4D_metrics(P);\r
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, threshold, freqLoc);\r
\r
    sum += v * amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);\r
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  return sum;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Voronoi Tile Noise (Edge-Aware) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateVoronoiTileNoise(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
  // match generateVoronoi zoom handling\r
  let zoom = max(params.zoom, 1e-6);\r
  var sum   : f32 = 0.0;\r
  var amp   : f32 = 1.0;\r
  var freqLoc : f32 = params.freq / zoom;\r
\r
  // always use the edge-threshold mode for this tile-noise helper\r
  let mode : u32 = params.voroMode;\r
  let edgeK : f32 = max(params.edgeK, 0.0);      // kept if you want to tune\r
  let thresh : f32 = max(params.threshold, 0.0);\r
\r
  // initial sample point (match non-toroidal branch of generateVoronoi)\r
  var x = (pos.x + params.xShift) / zoom;\r
  var y = (pos.y + params.yShift) / zoom;\r
  var z = (pos.z + params.zShift) / zoom;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    // build octave sample pos (same convention as generateVoronoi)\r
    let P = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);\r
\r
    // get metrics and evaluate using VORO_EDGE_THRESH (voro_eval implements F2-F1 gating)\r
    let m = voro3D_metrics(P);\r
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, thresh, freqLoc);\r
\r
    sum = sum + v * amp;\r
\r
    // octave updates\r
    freqLoc = freqLoc * params.lacunarity;\r
    amp     = amp * params.gain;\r
\r
    // apply simple per-octave drift (matches previous tile-style)\r
    x = x + params.xShift;\r
    y = y + params.yShift;\r
    z = z + params.zShift;\r
  }\r
\r
  // NOTE: generateVoronoi returns the raw sum (not remapped).\r
  // If you need legacy behaviour that remapped to [-1,1], uncomment the next line:\r
  // return 2.0 * sum - 1.0;\r
\r
  return sum;\r
}\r
\r
\r
// BM1: f( f(p) )\r
fn generateVoronoiBM1(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoiTileNoise(p, par);\r
  return generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2: f( p + f(f(p)) )\r
fn generateVoronoiBM2(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoiTileNoise(p, par);\r
  let f2 = generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3: f( p + f(p + f(p)) )\r
fn generateVoronoiBM3(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoiTileNoise(p, par);\r
  let f2 = generateVoronoiTileNoise(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
/* ---- Voronoi Brownian-Motion flavours (4D) ---------------------------------- */\r
\r
// BM1 4D: f( f(p) )  (scalar feedback into XYZ, keep W/time from params)\r
fn generateVoronoiBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoi4D(p, par);\r
  return generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2 4D: f( p + f(f(p)) )\r
fn generateVoronoiBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoi4D(p, par);\r
  let f2 = generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3 4D: f( p + f(p + f(p)) )\r
fn generateVoronoiBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoi4D(p, par);\r
  let f2 = generateVoronoi4D(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
/* ---- vector-feedback variants (stronger, less axis-locked) ---------\r
   These keep it cheap but reduce the "all axes get same scalar" look by building\r
   a 3-vector from 3 decorrelated samples (offsets are constant, no extra params).\r
*/\r
\r
fn _bm4D_vec(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = generateVoronoi4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = generateVoronoi4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = generateVoronoi4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
// BM1 4D (vec): f( vec(f(p)) )\r
fn generateVoronoiBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec(p, par);\r
  return generateVoronoi4D(v1 * par.zoom, par);\r
}\r
\r
// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )\r
fn generateVoronoiBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec(p, par);\r
  let v2 = _bm4D_vec(v1 * par.zoom, par);\r
  return generateVoronoi4D(p + v2 * par.zoom, par);\r
}\r
\r
// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )\r
fn generateVoronoiBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec(p, par);\r
  let v2 = _bm4D_vec(p + v1 * par.zoom, par);\r
  return generateVoronoi4D(p + v2 * par.zoom, par);\r
}\r
\r
// Generic "Voronoi-style" sampler for Cellular/Worley so they can share voro_eval modes.\r
\r
struct VoroSample {\r
  f1Sq    : f32,\r
  f2Sq    : f32,\r
  cellVal : f32,\r
};\r
\r
fn voro_sample3D(p: vec3<f32>) -> VoroSample {\r
  let fx = i32(floor(p.x));\r
  let fy = i32(floor(p.y));\r
  let fz = i32(floor(p.z));\r
\r
  var d1: f32 = 1e9;\r
  var d2: f32 = 1e9;\r
  var cv: f32 = 0.0;\r
\r
  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
        let xi = fx + dx;\r
        let yi = fy + dy;\r
        let zi = fz + dz;\r
\r
        let rx = rand3u(xi, yi, zi);\r
        let ry = rand3u(yi, zi, xi);\r
        let rz = rand3u(zi, xi, yi);\r
\r
        let px = f32(xi) + rx;\r
        let py = f32(yi) + ry;\r
        let pz = f32(zi) + rz;\r
\r
        let dxv = px - p.x;\r
        let dyv = py - p.y;\r
        let dzv = pz - p.z;\r
        let dd  = dxv * dxv + dyv * dyv + dzv * dzv;\r
\r
        if (dd < d1) {\r
          d2 = d1;\r
          d1 = dd;\r
          cv = rand3u(xi, zi, yi);\r
        } else if (dd < d2) {\r
          d2 = dd;\r
        }\r
      }\r
    }\r
  }\r
\r
  return VoroSample(d1, d2, cv);\r
}\r
\r
fn voro_sample4D(p: vec4<f32>) -> VoroSample {\r
  let fx = i32(floor(p.x));\r
  let fy = i32(floor(p.y));\r
  let fz = i32(floor(p.z));\r
  let fw = i32(floor(p.w));\r
\r
  var d1: f32 = 1e9;\r
  var d2: f32 = 1e9;\r
  var cv: f32 = 0.0;\r
\r
  for (var dw: i32 = -1; dw <= 1; dw = dw + 1) {\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
      for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
          let xi = fx + dx;\r
          let yi = fy + dy;\r
          let zi = fz + dz;\r
          let wi = fw + dw;\r
\r
          let rx = rand4u(xi, yi, zi, wi);\r
          let ry = rand4u(yi, zi, wi, xi);\r
          let rz = rand4u(zi, wi, xi, yi);\r
          let rw = rand4u(wi, xi, yi, zi);\r
\r
          let px = f32(xi) + rx;\r
          let py = f32(yi) + ry;\r
          let pz = f32(zi) + rz;\r
          let pw = f32(wi) + rw;\r
\r
          let dxv = px - p.x;\r
          let dyv = py - p.y;\r
          let dzv = pz - p.z;\r
          let dwv = pw - p.w;\r
          let dd  = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;\r
\r
          if (dd < d1) {\r
            d2 = d1;\r
            d1 = dd;\r
            cv = rand4u(xi, zi, yi, wi);\r
          } else if (dd < d2) {\r
            d2 = dd;\r
          }\r
        }\r
      }\r
    }\r
  }\r
\r
  return VoroSample(d1, d2, cv);\r
}\r
\r
fn cellular4D(p: vec4<f32>) -> f32 {\r
  let s = voro_sample4D(p);\r
  return voro_edge_dist(s.f1Sq, s.f2Sq);\r
}\r
\r
fn worley4D(p: vec4<f32>) -> f32 {\r
  let s = voro_sample4D(p);\r
  return sqrt(max(s.f1Sq, 0.0));\r
}\r
\r
// Expects you to pass the same controls you use for Voronoi: params.voroMode, params.edgeK, params.threshold.\r
fn generateCellular(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  var x = (pos.x + params.xShift) / params.zoom;\r
  var y = (pos.y + params.yShift) / params.zoom;\r
  var z = (pos.z + params.zShift) / params.zoom;\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = params.freq;\r
  var angle   : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
\r
    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    n = clamp(n, 0.0, 1.0);\r
\r
    sum = sum + n * amp;\r
\r
    freqLoc = freqLoc * params.lacunarity;\r
    amp     = amp     * params.gain;\r
\r
    let c = cos(angle);\r
    let sA = sin(angle);\r
    let nx = x * c - y * sA;\r
    let ny = x * sA + y * c;\r
    let nz = y * sA + z * c;\r
\r
    x = nx + params.xShift;\r
    y = ny + params.yShift;\r
    z = nz + params.zShift;\r
    angle = angle + ANGLE_INCREMENT;\r
  }\r
\r
  if (params.turbulence == 1u) { sum = sum - 1.0; }\r
  return 2.0 * sum - 1.0;\r
}\r
\r
fn generateAntiCellular(pos: vec3<f32>, params: NoiseParams) -> f32 { \r
  return -generateCellular(pos,params);\r
}\r
\r
fn generateWorley(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  var x = (pos.x + params.xShift) / params.zoom;\r
  var y = (pos.y + params.yShift) / params.zoom;\r
  var z = (pos.z + params.zShift) / params.zoom;\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = params.freq;\r
  var angle   : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
\r
    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    n = clamp(n, 0.0, 1.0);\r
\r
    sum = sum + n * amp;\r
\r
    freqLoc = freqLoc * params.lacunarity;\r
    amp     = amp     * params.gain;\r
\r
    let c = cos(angle);\r
    let sA = sin(angle);\r
    let nx = x * c - y * sA;\r
    let ny = x * sA + y * c;\r
    let nz = y * sA + z * c;\r
\r
    x = nx + params.xShift;\r
    y = ny + params.yShift;\r
    z = nz + params.zShift;\r
    angle = angle + ANGLE_INCREMENT;\r
  }\r
\r
  if (params.turbulence == 1u) { sum = sum - 1.0; }\r
  return sum - 1.0;\r
}\r
\r
fn generateAntiWorley(pos: vec3<f32>, params: NoiseParams) -> f32 { \r
  return -generateWorley(pos,params);\r
}\r
\r
fn generateCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base    : vec4<f32>;\r
  var freqLoc : f32;\r
\r
  if (params.toroidal == 1u) {\r
    base    = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
    freqLoc = params.freq;\r
  } else {\r
    base = vec4<f32>(\r
      pos.x / zoom * params.freq + params.xShift,\r
      pos.y / zoom * params.freq + params.yShift,\r
      pos.z / zoom * params.freq + params.zShift,\r
      params.time\r
    );\r
    freqLoc = params.freq;\r
  }\r
\r
  var sum   : f32 = 0.0;\r
  var amp   : f32 = 1.0;\r
  var angle : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample4D(base * freqLoc);\r
\r
    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { v = abs(v); }\r
    v = clamp(v, 0.0, 1.0);\r
\r
    sum += v * amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let sA = sin(angle);\r
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );\r
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  if (params.turbulence == 1u) { sum -= 1.0; }\r
  return 2.0 * sum - 1.0;\r
}\r
\r
fn generateAntiCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return -generateCellular4D(pos,params);\r
}\r
\r
fn generateWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base    : vec4<f32>;\r
  var freqLoc : f32;\r
\r
  if (params.toroidal == 1u) {\r
    base    = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
    freqLoc = params.freq;\r
  } else {\r
    base = vec4<f32>(\r
      pos.x / zoom * params.freq + params.xShift,\r
      pos.y / zoom * params.freq + params.yShift,\r
      pos.z / zoom * params.freq + params.zShift,\r
      params.time\r
    );\r
    freqLoc = params.freq;\r
  }\r
\r
  var sum    : f32 = 0.0;\r
  var amp    : f32 = 1.0;\r
  var ampSum : f32 = 0.0;\r
  var angle  : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample4D(base * freqLoc);\r
\r
    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { v = abs(v); }\r
    v = clamp(v, 0.0, 1.0);\r
\r
    sum    += v * amp;\r
    ampSum += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let sA = sin(angle);\r
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );\r
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  let out = select(0.0, sum / ampSum, ampSum > 0.0);\r
\r
  if (params.turbulence == 1u) { return clamp(out - 1.0, -1.0, 1.0); }\r
  return clamp(1.0 - out, 0.0, 1.0);\r
}\r
\r
fn generateAntiWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return 1-generateWorley4D(pos,params);\r
}\r
\r
/* ---- Cellular Brownian-Motion flavours (4D) ---------------------------------- */\r
\r
// BM1 4D: f( f(p) )\r
fn generateCellularBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateCellular4D(p, par);\r
  return generateCellular4D(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2 4D: f( p + f(f(p)) )\r
fn generateCellularBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateCellular4D(p, par);\r
  let f2 = generateCellular4D(vec3<f32>(f1 * par.zoom), par);\r
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3 4D: f( p + f(p + f(p)) )\r
fn generateCellularBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateCellular4D(p, par);\r
  let f2 = generateCellular4D(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
\r
/* ---- Worley Brownian-Motion flavours (4D) ----------------------------------- */\r
\r
// BM1 4D: f( f(p) )\r
fn generateWorleyBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateWorley4D(p, par);\r
  return generateWorley4D(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2 4D: f( p + f(f(p)) )\r
fn generateWorleyBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateWorley4D(p, par);\r
  let f2 = generateWorley4D(vec3<f32>(f1 * par.zoom), par);\r
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3 4D: f( p + f(p + f(p)) )\r
fn generateWorleyBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateWorley4D(p, par);\r
  let f2 = generateWorley4D(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
\r
/* ---- vector-feedback variants (stronger, less axis-locked) ------------------ */\r
\r
fn _bm4D_vec_cellular(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = generateCellular4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = generateCellular4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = generateCellular4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
fn _bm4D_vec_worley(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = generateWorley4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = generateWorley4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = generateWorley4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
\r
// BM1 4D (vec): f( vec(f(p)) )\r
fn generateCellularBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_cellular(p, par);\r
  return generateCellular4D(v1 * par.zoom, par);\r
}\r
\r
// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )\r
fn generateCellularBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_cellular(p, par);\r
  let v2 = _bm4D_vec_cellular(v1 * par.zoom, par);\r
  return generateCellular4D(p + v2 * par.zoom, par);\r
}\r
\r
// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )\r
fn generateCellularBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_cellular(p, par);\r
  let v2 = _bm4D_vec_cellular(p + v1 * par.zoom, par);\r
  return generateCellular4D(p + v2 * par.zoom, par);\r
}\r
\r
\r
// BM1 4D (vec): f( vec(f(p)) )\r
fn generateWorleyBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_worley(p, par);\r
  return generateWorley4D(v1 * par.zoom, par);\r
}\r
\r
// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )\r
fn generateWorleyBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_worley(p, par);\r
  let v2 = _bm4D_vec_worley(v1 * par.zoom, par);\r
  return generateWorley4D(p + v2 * par.zoom, par);\r
}\r
\r
// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )\r
fn generateWorleyBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_worley(p, par);\r
  let v2 = _bm4D_vec_worley(p + v1 * par.zoom, par);\r
  return generateWorley4D(p + v2 * par.zoom, par);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;\r
  } else {\r
    base = vec4<f32>(\r
      (pos.x / zoom) * params.freq + params.xShift,\r
      (pos.y / zoom) * params.freq + params.yShift,\r
      (pos.z / zoom) * params.freq + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var freqLoc: f32 = params.freq;\r
  var ampSum: f32 = 0.0;\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let n = noise4D(base * freqLoc);\r
    let b = pow(abs(n), 0.75);\r
    sum += b * amp;\r
    ampSum += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);\r
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  if (ampSum > 0.0) { sum /= ampSum; }\r
\r
  let k: f32 = 1.2;\r
  let cMid = sum - 0.5;\r
  let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));\r
\r
  return clamp(shaped, 0.0, 1.0);\r
}\r
\r
fn generateAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return 1.0 - generateBillow4D(pos, params);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Terrace + Foam + Turbulence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateTerraceNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  let base = generatePerlin4D(pos, par);\r
  return terrace(base, par.terraceStep);\r
}\r
\r
fn generateFoamNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  let base = generateBillow4D(pos, par);\r
  return foamify(base);\r
}\r
\r
fn generateTurbulence4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  let base = generatePerlin4D(pos, par);\r
  return turbulence(base);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D "Lanczos-like" Lowpass \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn lowpass4D(p: vec4<f32>) -> f32 {\r
  let o = vec4<f32>(0.37, 0.21, 0.29, 0.31);\r
  let a = noise4D(p);\r
  let b = noise4D(p + vec4<f32>(o.x, 0.0, 0.0, 0.0));\r
  let c = noise4D(p + vec4<f32>(0.0, o.y, 0.0, 0.0));\r
  let d = noise4D(p + vec4<f32>(0.0, 0.0, o.z, 0.0));\r
  let e = noise4D(p + vec4<f32>(0.0, 0.0, 0.0, o.w));\r
  return (a + b + c + d + e) * 0.2;\r
}\r
\r
fn generateLanczosBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;\r
  } else {\r
    base = vec4<f32>(\r
      (pos.x / zoom) * params.freq + params.xShift,\r
      (pos.y / zoom) * params.freq + params.yShift,\r
      (pos.z / zoom) * params.freq + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var maxAmp: f32 = 0.0;\r
  var freqLoc: f32 = params.freq;\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let n = lowpass4D(base * freqLoc);\r
    sum += (2.0 * abs(n) - 1.0) * amp;\r
    maxAmp += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);\r
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  return select(0.0, sum / maxAmp, maxAmp > 0.0);\r
}\r
\r
fn generateLanczosAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return -generateLanczosBillow4D(pos, params);\r
}\r
\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D FBM core + generators \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn fbm4D_core(base: vec4<f32>, params: NoiseParams) -> f32 {\r
  var p = base;\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var maxAmp: f32 = 0.0;\r
  var freqLoc: f32 = params.freq;\r
\r
  var angle: f32 = params.seedAngle;\r
  let angleInc: f32 = 2.0 * PI / max(f32(params.octaves), 1.0);\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    sum += amp * noise4D(p * freqLoc);\r
    maxAmp += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      angle += angleInc;\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(p.x * c - p.y * s, p.x * s + p.y * c);\r
      let zw = vec2<f32>(p.z * c - p.w * s, p.z * s + p.w * c);\r
      p = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
    }\r
  }\r
\r
  return select(0.0, sum / maxAmp, maxAmp > 0.0);\r
}\r
\r
fn fbm4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  if (params.toroidal == 1u) {\r
    let base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;\r
    return fbm4D_core(base, params);\r
  }\r
\r
  let base = vec4<f32>(\r
    (pos.x + params.xShift) / zoom,\r
    (pos.y + params.yShift) / zoom,\r
    (pos.z + params.zShift) / zoom,\r
    params.time\r
  );\r
  return fbm4D_core(base, params);\r
}\r
\r
fn generateFBM4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let fbm1 = fbm4D(pos, params);\r
  let fbm2 = fbm4D_core(vec4<f32>(fbm1, fbm1, fbm1, fbm1), params);\r
  return 2.0 * fbm2;\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM (4D)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
\r
fn domainWarpFBM4D(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {\r
  var q = p;\r
  for (var i: u32 = 0u; i < stages; i = i + 1u) {\r
    let w = fbm4D(q, params) * warpAmp;\r
    q = q + vec3<f32>(w, w, w);\r
  }\r
  return fbm4D(q, params);\r
}\r
\r
fn generateDomainWarpFBM1_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D(pos, par, par.warpAmp, 1u);\r
}\r
\r
fn generateDomainWarpFBM2_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D(pos, par, par.warpAmp, 2u);\r
}\r
\r
fn _warpVecFrom4D(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = fbm4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = fbm4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = fbm4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
fn domainWarpFBM4D_vec(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {\r
  var q = p;\r
  for (var i: u32 = 0u; i < stages; i = i + 1u) {\r
    let v = _warpVecFrom4D(q, params) * warpAmp;\r
    q = q + v;\r
  }\r
  return fbm4D(q, params);\r
}\r
\r
fn generateDomainWarpFBM1_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 1u);\r
}\r
\r
fn generateDomainWarpFBM2_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 2u);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateLanczosBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {\r
    var x       = (pos.x + p.xShift) / p.zoom;\r
    var y       = (pos.y + p.yShift) / p.zoom;\r
    var z       = (pos.z + p.zShift) / p.zoom;\r
    var sum     : f32 = 0.0;\r
    var maxAmp  : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = p.freq;\r
    var angle   : f32 = p.seedAngle;\r
\r
    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
        let n = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        sum = sum + (2.0 * abs(n) - 1.0) * amp;\r
        maxAmp = maxAmp + amp;\r
\r
        freqLoc = freqLoc * p.lacunarity;\r
        amp     = amp     * p.gain;\r
\r
        // rotation around Z\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        var newX = x * c - y * s;\r
        var newY = x * s + y * c;\r
        var newZ = z;\r
\r
        // rotate in XZ plane\r
        let rX = newX * c + newZ * s;\r
        let rZ = -newX * s + newZ * c;\r
        newX = rX; newZ = rZ;\r
\r
        // rotate in YZ plane\r
        let rY = newY * c - newZ * s;\r
        let rZ2 = newY * s + newZ * c;\r
        newY = rY; newZ = rZ2;\r
\r
        // apply shift\r
        x = newX + p.xShift;\r
        y = newY + p.yShift;\r
        z = newZ + p.zShift;\r
\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    return sum / maxAmp;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Anti-Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateLanczosAntiBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {\r
    return -generateLanczosBillow(pos, p);\r
}\r
\r
\r
// Raw Voronoi circle\u2010gradient cell value\r
fn voronoiCircleGradient(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist    : f32 = 1e9;\r
    var secondDist : f32 = 1e9;\r
    var centerVal  : f32 = 0.0;\r
\r
    // search the 3\xD73\xD73 neighborhood\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
\r
                // pseudo\u2010random feature point within the cell\r
                let r0 = rand3u(xi, yi, zi);\r
                let r1 = rand3u(yi, zi, xi);\r
                let r2 = rand3u(zi, xi, yi);\r
                let px = f32(xi) + r0;\r
                let py = f32(yi) + r1;\r
                let pz = f32(zi) + r2;\r
\r
                // Euclidean distance\r
                let dx_ = px - pos.x;\r
                let dy_ = py - pos.y;\r
                let dz_ = pz - pos.z;\r
                let d   = sqrt(dx_*dx_ + dy_*dy_ + dz_*dz_);\r
\r
                // track the two smallest distances\r
                if (d < minDist) {\r
                    secondDist = minDist;\r
                    minDist    = d;\r
                    centerVal  = r0;           // store the cell\u2019s \u201Cvalue\u201D\r
                } else if (d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
\r
    // build the circle gradient: fall\u2010off from cell center\r
    let centerGrad = 1.0 - min(minDist, 1.0);\r
    // edge mask: if the ridge is too thin, kill it\r
    let edgeDist   = secondDist - minDist;\r
    let edgeGrad   = select(1.0, 0.0, edgeDist < params.threshold);\r
\r
    return centerGrad * edgeGrad;\r
}\r
\r
// Octaved generator matching your JS .generateNoise()\r
fn generateVoronoiCircleNoise(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    // zoom in/out\r
    var x       = (pos.x + params.xShift) / params.zoom;\r
    var y       = (pos.y + params.yShift) / params.zoom;\r
    var z       = (pos.z + params.zShift) / params.zoom;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);\r
        total = total + voronoiCircleGradient(samplePos, params) * amp;\r
\r
        // next octave\r
        amp  = amp  * params.gain;\r
        freq = freq * params.lacunarity;\r
        x    = x + params.xShift;\r
        y    = y + params.yShift;\r
        z    = z + params.zShift;\r
    }\r
\r
    // match JS: return \u2211noise \u2212 1.0\r
    return total - 1.0;\r
}\r
\r
\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 distance helpers (add once) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn euclideanDist(a: vec3<f32>, b: vec3<f32>) -> f32 {\r
  return length(a - b);\r
}\r
fn euclideanDistSq(a: vec3<f32>, b: vec3<f32>) -> f32 {\r
  let d = a - b;\r
  return dot(d, d);\r
}\r
\r
fn euclideanDist2(a: vec2<f32>, b: vec2<f32>) -> f32 {\r
  return length(a - b);\r
}\r
fn euclideanDistSq2(a: vec2<f32>, b: vec2<f32>) -> f32 {\r
  let d = a - b;\r
  return dot(d, d);\r
}\r
\r
fn euclideanDist4(a: vec4<f32>, b: vec4<f32>) -> f32 {\r
  return length(a - b);\r
}\r
fn euclideanDistSq4(a: vec4<f32>, b: vec4<f32>) -> f32 {\r
  let d = a - b;\r
  return dot(d, d);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500 1. Voronoi Circle\u2010Gradient Tile Noise 2 \u2500\u2500\u2500\u2500\u2500\r
\r
fn voronoiCircleGradient2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist : f32 = 1e9;\r
    var minVal  : f32 = 0.0;\r
    var closest : vec3<f32> = vec3<f32>(0.0);\r
\r
    for(var dz = -1; dz <= 1; dz = dz + 1) {\r
        for(var dy = -1; dy <= 1; dy = dy + 1) {\r
            for(var dx = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let r0 = rand3u(xi, yi, zi);\r
                let feature = vec3<f32>(f32(xi) + r0,\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if(d < minDist) {\r
                    minDist = d;\r
                    minVal = rand3u(xi, yi, zi);\r
                    closest = feature;\r
                }\r
            }\r
        }\r
    }\r
    let centerDist = euclideanDist(closest, pos);\r
    let gradient = sin(centerDist * PI);\r
    return minVal * gradient;\r
}\r
\r
fn generateVoronoiCircle2(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);\r
\r
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let samplePos = vec3<f32>(x * freq / params.zoom,\r
                                  y * freq / params.zoom,\r
                                  z * freq / params.zoom);\r
        total = total + voronoiCircleGradient2Raw(samplePos, params) * amp;\r
        amp   = amp * params.gain;\r
        freq  = freq * params.lacunarity;\r
        angle = angle + angleInc;\r
        x = x + params.xShift * cos(angle) + params.xShift;\r
        y = y + params.yShift * cos(angle) + params.yShift;\r
        z = z + params.zShift * cos(angle) + params.zShift;\r
    }\r
    return total - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500 2. Voronoi Flat\u2010Shade Tile Noise \u2500\u2500\u2500\u2500\u2500\r
\r
fn voronoiFlatShadeRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist    : f32 = 1e9;\r
    var secondDist : f32 = 1e9;\r
\r
    for(var dz = -1; dz <= 1; dz = dz + 1) {\r
        for(var dy = -1; dy <= 1; dy = dy + 1) {\r
            for(var dx = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if(d < minDist) {\r
                    secondDist = minDist;\r
                    minDist    = d;\r
                } else if(d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
    let edgeDist = secondDist - minDist;\r
    return select(1.0, 0.0, edgeDist < params.threshold);\r
}\r
\r
fn generateVoronoiFlatShade(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    var pos = posIn / params.zoom;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        total = total + voronoiFlatShadeRaw(pos * freq, params) * amp;\r
        amp  = amp * params.gain;\r
        freq = freq * params.lacunarity;\r
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    }\r
    return total;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500 3. Voronoi Ripple 3D \u2500\u2500\u2500\u2500\u2500\r
\r
fn voronoiRipple3DRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist    : f32 = 1e9;\r
    var secondDist : f32 = 1e9;\r
    var minVal     : f32 = 0.0;\r
\r
    for(var dz=-1; dz<=1; dz=dz+1) {\r
        for(var dy=-1; dy<=1; dy=dy+1) {\r
            for(var dx=-1; dx<=1; dx=dx+1) {\r
                let xi = fx+dx;\r
                let yi = fy+dy;\r
                let zi = fz+dz;\r
                let feature = vec3<f32>(f32(xi)+rand3u(xi,yi,zi),\r
                                        f32(yi)+rand3u(yi,zi,xi),\r
                                        f32(zi)+rand3u(zi,xi,yi));\r
                let d = euclideanDist(feature, pos);\r
                if(d < minDist) {\r
                    secondDist = minDist;\r
                    minDist    = d;\r
                    minVal     = rand3u(xi, yi, zi);\r
                } else if(d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
    let edgeDist = secondDist - minDist;\r
    let ripple   = sin(PI + edgeDist * PI * params.rippleFreq + params.time);\r
    return minVal * (1.0 + ripple) * 0.5;\r
}\r
\r
fn generateVoronoiRipple3D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
    for(var i: u32=0u; i<params.octaves; i=i+1u) {\r
        let sample = vec3<f32>(x * freq / params.zoom,\r
                               y * freq / params.zoom,\r
                               z * freq / params.zoom);\r
        total = total + voronoiRipple3DRaw(sample, params) * amp;\r
        amp   = amp * params.gain;\r
        freq  = freq * params.lacunarity;\r
        let angle = params.seedAngle * 2.0 * PI;\r
        x = x + params.xShift * cos(angle + f32(i));\r
        y = y + params.yShift * cos(angle + f32(i));\r
        z = z + params.zShift * cos(angle + f32(i));\r
    }\r
    return 2.0 * total - 1.0;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500 4. Voronoi Ripple 3D 2 \u2500\u2500\u2500\u2500\u2500\r
fn voronoiRipple3D2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist: f32 = 1e9;\r
    var secondDist: f32 = 1e9;\r
    var minVal: f32 = 0.0;\r
\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if (d < minDist) {\r
                    secondDist = minDist;\r
                    minDist = d;\r
                    minVal = rand3u(xi, yi, zi);\r
                } else if (d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
    let edgeDist = secondDist - minDist;\r
    let ripple = sin(PI + params.zoom * edgeDist * PI * params.rippleFreq + params.time);\r
    return minVal * (1.0 + ripple) * 0.5;\r
}\r
\r
fn generateVoronoiRipple3D2(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let sample = vec3<f32>(x * freq / params.zoom,\r
                               y * freq / params.zoom,\r
                               z * freq / params.zoom);\r
        total = total + voronoiRipple3D2Raw(sample, params) * amp;\r
        amp = amp * params.gain;\r
        freq = freq * params.lacunarity;\r
        let angle = params.seedAngle * 2.0 * PI;\r
        x = x + params.xShift * cos(angle + f32(i));\r
        y = y + params.yShift * cos(angle + f32(i));\r
        z = z + params.zShift * cos(angle + f32(i));\r
    }\r
    return 2.0 * total - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500 5. Voronoi Circular Ripple 3D \u2500\u2500\u2500\u2500\u2500\r
fn voronoiCircularRippleRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist: f32 = 1e9;\r
    var minVal: f32 = 0.0;\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if (d < minDist) {\r
                    minDist = d;\r
                    minVal = rand3u(xi, yi, zi);\r
                }\r
            }\r
        }\r
    }\r
    let ripple = sin(PI + minDist * PI * params.rippleFreq + params.time);\r
    return minVal * (1.0 + ripple) * 0.5;\r
}\r
\r
fn generateVoronoiCircularRipple(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let sample = vec3<f32>(x * freq / params.zoom,\r
                               y * freq / params.zoom,\r
                               z * freq / params.zoom);\r
        total = total + voronoiCircularRippleRaw(sample, params) * amp;\r
        amp = amp * params.gain;\r
        freq = freq * params.lacunarity;\r
        let angle = params.seedAngle * 2.0 * PI;\r
        x = x + params.xShift * cos(angle + f32(i));\r
        y = y + params.yShift * cos(angle + f32(i));\r
        z = z + params.zShift * cos(angle + f32(i));\r
    }\r
    return 2.0 * total - 1.0;\r
}\r
\r
// 6a. Fractal Voronoi Ripple 3D\r
fn generateFVoronoiRipple3D(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    // first FBM pass\r
    let fbm1 = generateVoronoiRipple3D(posIn, params);\r
\r
    // prepare second\u2010pass params: keep everything the same except zoom=1\r
    var p2 = params;\r
    p2.zoom = 1.0;\r
\r
    // second FBM pass, feeding the scalar result back into xyz\r
    let sample = vec3<f32>(fbm1, fbm1, fbm1);\r
    let fbm2   = generateVoronoiRipple3D(sample, p2);\r
\r
    return 2.0 * fbm2;\r
}\r
\r
// 6b. Fractal Voronoi Circular Ripple 3D\r
fn generateFVoronoiCircularRipple(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    // first FBM pass\r
    let fbm1 = generateVoronoiCircularRipple(posIn, params);\r
\r
    // second\u2010pass with zoom=1\r
    var p2 = params;\r
    p2.zoom = 1.0;\r
\r
    let sample = vec3<f32>(fbm1, fbm1, fbm1);\r
    let fbm2   = generateVoronoiCircularRipple(sample, p2);\r
\r
    return 2.0 * fbm2;\r
}\r
\r
// \u2014\u2014\u2014 continuousPermutation \u2014\u2014\u2014\r
fn continuousPermutation(value: f32) -> f32 {\r
    let iVal    = floor(value);\r
    let frac    = value - iVal;\r
    let i0      = i32(iVal);\r
    let idx1    = u32((i0 % 256 + 256) % 256);\r
    let idx2    = u32(((i0 + 1) % 256 + 256) % 256);\r
    let v1      = f32(perm(idx1));\r
    let v2      = f32(perm(idx2));\r
    return v1 + frac * (v2 - v1);\r
}\r
\r
// \u2014\u2014\u2014 calculateRippleEffect \u2014\u2014\u2014\r
fn calculateRippleEffect(pos: vec3<f32>,\r
                         rippleFreq: f32,\r
                         neighborhoodSize: i32) -> f32 {\r
    var sum: f32 = 0.0;\r
    var count: f32 = 0.0;\r
    for (var dz = -neighborhoodSize; dz <= neighborhoodSize; dz = dz + 1) {\r
        for (var dy = -neighborhoodSize; dy <= neighborhoodSize; dy = dy + 1) {\r
            for (var dx = -neighborhoodSize; dx <= neighborhoodSize; dx = dx + 1) {\r
                let sample = vec3<f32>(\r
                    continuousPermutation(pos.x + f32(dx)),\r
                    continuousPermutation(pos.y + f32(dy)),\r
                    continuousPermutation(pos.z + f32(dz))\r
                );\r
                let d = length(sample - pos);\r
                sum = sum + sin(d * PI * rippleFreq);\r
                count = count + 1.0;\r
            }\r
        }\r
    }\r
    return sum / count;\r
}\r
\r
// \u2014\u2014\u2014 generateRippleNoise \u2014\u2014\u2014\r
fn generateRippleNoise(pos: vec3<f32>, p: NoiseParams) -> f32 {\r
    var x = (pos.x + p.xShift) / p.zoom;\r
    var y = (pos.y + p.yShift) / p.zoom;\r
    var z = (pos.z + p.zShift) / p.zoom;\r
    var sum: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = p.freq;\r
    var angle: f32 = p.seedAngle * 2.0 * PI;\r
    let angleInc = 2.0 * PI / f32(p.octaves);\r
    let rippleFreqScaled = p.rippleFreq / p.zoom;\r
    let neigh = i32(p.exp1);\r
\r
    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
        var n = /* your base noise fn */ lanczos3D(vec3<f32>(x * freq, y * freq, z * freq)) * amp;\r
        if (p.turbulence == 1u) {\r
            n = abs(n);\r
        }\r
        let rip = calculateRippleEffect(vec3<f32>(x * freq, y * freq, z * freq),\r
                                        rippleFreqScaled,\r
                                        neigh);\r
        sum = sum + n * rip;\r
\r
        freq   = freq * p.lacunarity;\r
        amp    = amp * p.gain;\r
        angle  = angle + angleInc;\r
\r
        // simple phase offset; replace 0.0 with a hash if desired\r
        let phase: f32 = 0.0;\r
        x = x + p.xShift * cos(angle + phase);\r
        y = y + p.yShift * cos(angle + phase);\r
        z = z + p.zShift * cos(angle + phase);\r
    }\r
\r
    if (p.turbulence == 1u) {\r
        sum = sum - 1.0;\r
    }\r
    return f32(p.octaves) * sum;\r
}\r
\r
// \u2014\u2014\u2014 generateFractalRipples \u2014\u2014\u2014\r
fn generateFractalRipples(posIn: vec3<f32>, p: NoiseParams) -> f32 {\r
    // first pass at zoom scaled by exp2\r
    var p1 = p;\r
    p1.zoom = p.zoom * p.exp2+1.5;\r
    let fbm1 = generateRippleNoise(posIn, p1);\r
\r
    // second pass feeding fbm1 back into xyz\r
    var p2 = p;\r
    let sample = vec3<f32>(fbm1, fbm1, fbm1);\r
    let fbm2   = generateRippleNoise(sample, p2);\r
\r
    return 2.0 * fbm2;\r
}\r
\r
// \u2014\u2014\u2014 1. HexWorms Raw \u2014\u2014\u2014\r
fn hexWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let steps       : u32 = 5u;\r
    let persistence : f32 = 0.5;\r
    var total       : f32 = 0.0;\r
    var frequency   : f32 = 1.0;\r
    var amplitude   : f32 = 1.0;\r
\r
    for (var i: u32 = 0u; i < steps; i = i + 1u) {\r
        // base cellular noise for direction\r
        let angle = generateCellular(pos * frequency, params) * 2.0 * PI;\r
\r
        // step along the \u201Cworm\u201D\r
        let offset = vec3<f32>(\r
            cos(angle),\r
            sin(angle),\r
            sin(angle)\r
        ) * 0.5;\r
        let samplePos = pos + offset;\r
\r
        // accumulate\r
        total = total + generateCellular(samplePos, params) * amplitude;\r
\r
        amplitude = amplitude * persistence;\r
        frequency = frequency * 2.0;\r
    }\r
\r
    // match JS: subtract 1 at the end\r
    return total - 1.0;\r
}\r
\r
// \u2014\u2014\u2014 2. HexWorms Generator \u2014\u2014\u2014\r
fn generateHexWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    var pos   = posIn / params.zoom;\r
    var sum   : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        sum = sum + hexWormsRaw(pos * freq, params) * amp;\r
        freq = freq * params.lacunarity;\r
        amp  = amp * params.gain;\r
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    }\r
\r
    return sum;\r
}\r
\r
// \u2014\u2014\u2014 3. PerlinWorms Raw \u2014\u2014\u2014\r
fn perlinWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let steps       : u32 = 5u;\r
    let persistence : f32 = 0.5;\r
    var total       : f32 = 0.0;\r
    var frequency   : f32 = 1.0;\r
    var amplitude   : f32 = 1.0;\r
\r
    for (var i: u32 = 0u; i < steps; i = i + 1u) {\r
        // base Perlin noise for direction\r
        let angle = generatePerlin(pos * frequency, params) * 2.0 * PI;\r
\r
        // step along the \u201Cworm\u201D\r
        let offset = vec3<f32>(\r
            cos(angle),\r
            sin(angle),\r
            sin(angle)\r
        ) * 0.5;\r
        let samplePos = pos + offset;\r
\r
        // accumulate\r
        total = total + generatePerlin(samplePos, params) * amplitude;\r
\r
        amplitude = amplitude * persistence;\r
        frequency = frequency * 2.0;\r
    }\r
\r
    return total;\r
}\r
\r
// \u2014\u2014\u2014 PerlinWorms Generator \u2014\u2014\u2014\r
fn generatePerlinWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    var pos   = posIn / params.zoom;\r
    var sum   : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        sum = sum + perlinWormsRaw(pos * freq, params) * amp;\r
        freq = freq * params.lacunarity;\r
        amp  = amp * params.gain;\r
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    }\r
\r
    return sum;\r
}\r
\r
// small helper: derive a few pseudorandom offsets from seed (u32)\r
fn seedOffsets(seed: u32) -> vec3<f32> {\r
  let s = f32(seed);\r
  let a = fract(sin(s * 12.9898) * 43758.5453);\r
  let b = fract(sin((s + 17.0) * 78.233) * 23421.631);\r
  let c = fract(sin((s + 31.0) * 37.719) * 97531.135);\r
  return vec3<f32>(a, b, c) * 0.5;\r
}\r
\r
// safe tile sizes (u32) derived from Frame (avoid zero)\r
fn tileSizeX() -> u32 { return max(frame.tileWidth, 1u); }\r
fn tileSizeY() -> u32 { return max(frame.tileHeight, 1u); }\r
fn tileSizeZ() -> u32 { return max(frame.tileDepth, 1u); }\r
\r
// --- helper: map pos -> integer pixel coords (uses frame uniform) ----------\r
// Returns wrapped pixel coords (periodic) so noise will tile across chunks.\r
fn posToPixelCoords_tiled(p : vec3<f32>) -> vec3<u32> {\r
  let fx = p.x * f32(frame.fullWidth);\r
  let fy = p.y * f32(frame.fullHeight);\r
\r
  let ox_i : i32 = max(frame.originX, 0);\r
  let oy_i : i32 = max(frame.originY, 0);\r
\r
  // integer pixel coords (unwrapped)\r
  let pxu : u32 = u32(floor(fx)) + u32(ox_i);\r
  let pyu : u32 = u32(floor(fy)) + u32(oy_i);\r
\r
  let layer_i = max(frame.layerIndex, 0);\r
  let layer_u : u32 = u32(layer_i);\r
\r
  // wrap coordinates into tile using modulo (cheap & correct for arbitrary tile sizes)\r
  let tx = tileSizeX();\r
  let ty = tileSizeY();\r
  let tz = tileSizeZ();\r
  let rx = pxu % tx;\r
  let ry = pyu % ty;\r
  let rz = layer_u % tz;\r
\r
  return vec3<u32>(rx, ry, rz);\r
}\r
\r
// --- deterministic integer hash that mixes seed (uses perm table) ---\r
// perm(...) implementation expected elsewhere (perm indexes 0..511)\r
fn hashed_with_seed(ix: u32, iy: u32, iz: u32, seed: u32) -> u32 {\r
  let a = perm((ix + seed * 1664525u) & 511u);\r
  let b = perm((a + (iy + seed * 22695477u)) & 511u);\r
  let c = perm((b + (iz + seed * 1103515245u)) & 511u);\r
  return c & 511u;\r
}\r
fn hashTo01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {\r
  return f32(hashed_with_seed(ix, iy, iz, seed)) / 511.0;\r
}\r
fn hashToSigned01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {\r
  return hashTo01_seeded(ix, iy, iz, seed) * 2.0 - 1.0;\r
}\r
\r
// integer lattice helper consistent with the perm table, tiled by Frame sizes.\r
// p is continuous; freq and shifts control lattice alignment.\r
fn posToIntsForHash_tiled(p: vec3<f32>, freq: f32, sx: f32, sy: f32, sz: f32) -> vec3<u32> {\r
  let fx = floor(p.x * freq + sx);\r
  let fy = floor(p.y * freq + sy);\r
  let fz = floor(p.z * freq + sz);\r
\r
  // cast and wrap to tile-size\r
  let tx = tileSizeX();\r
  let ty = tileSizeY();\r
  let tz = tileSizeZ();\r
\r
  let ix = u32(fx) % tx;\r
  let iy = u32(fy) % ty;\r
  let iz = u32(fz) % tz;\r
  return vec3<u32>(ix, iy, iz);\r
}\r
\r
// ---------------------- tiled value-noise 2D (smooth) ----------------------\r
// Uses posToIntsForHash_tiled internally => tiled/periodic by Frame tile sizes.\r
fn valueNoise2D_seeded(p : vec2<f32>, freq: f32, seed: u32, sx: f32, sy: f32) -> f32 {\r
  let f = max(freq, 1e-6);\r
  let fx = p.x * f + sx;\r
  let fy = p.y * f + sy;\r
  let ix_f = floor(fx);\r
  let iy_f = floor(fy);\r
  let txf = fx - ix_f;\r
  let tyf = fy - iy_f;\r
\r
  // get tiled integer lattice coords (z = 0)\r
  let base = posToIntsForHash_tiled(vec3<f32>(ix_f, iy_f, 0.0), 1.0, 0.0, 0.0, 0.0);\r
  let ix = base.x;\r
  let iy = base.y;\r
\r
  // neighbors (wrapped by tile in posToIntsForHash_tiled above)\r
  let ix1 = (ix + 1u) % tileSizeX();\r
  let iy1 = (iy + 1u) % tileSizeY();\r
\r
  let h00 = hashToSigned01_seeded(ix,  iy,  0u, seed);\r
  let h10 = hashToSigned01_seeded(ix1, iy,  0u, seed);\r
  let h01 = hashToSigned01_seeded(ix,  iy1, 0u, seed);\r
  let h11 = hashToSigned01_seeded(ix1, iy1, 0u, seed);\r
\r
  let sx_f = fade(txf);\r
  let sy_f = fade(tyf);\r
  let a = lerp(h00, h10, sx_f);\r
  let b = lerp(h01, h11, sx_f);\r
  return lerp(a, b, sy_f);\r
}\r
\r
// ---------------------- White Noise (tiled, seeded, contrast/gain) ----\r
fn generateWhiteNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
  let seed : u32 = params.seed;\r
\r
  // integer pixel coords (wrapped to tile)\r
  let ip = posToPixelCoords_tiled(pos);\r
\r
  // subsampling (blocky) or per-pixel; safe cast\r
  let subs = max(u32(max(params.freq, 1.0)), 1u);\r
  let sx = (ip.x / subs) % tileSizeX();\r
  let sy = (ip.y / subs) % tileSizeY();\r
  let sz = ip.z % tileSizeZ();\r
\r
  var v01 = hashTo01_seeded(sx, sy, sz, seed);\r
\r
  // apply contrast around 0.5 via params.gain\r
  let contrast = 1.0 + params.gain;\r
  v01 = (v01 - 0.5) * contrast + 0.5;\r
\r
  return clamp(v01, 0.0, 1.0);\r
}\r
\r
// ---------------------- Blue Noise Generator (tiled, seeded) -------------\r
fn generateBlueNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
  let seed : u32 = params.seed;\r
\r
  // pixel-space coords\r
  let px = pos.xy * vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\r
\r
  // scale control (same heuristic you had)\r
  let pixelBase = max(min(f32(frame.fullWidth), f32(frame.fullHeight)), 1.0);\r
  let highScale = max(params.freq * 0.02 * pixelBase, 1e-6);\r
  let lowScaleFactor = 0.12;\r
  let lowScale = max(highScale * lowScaleFactor, 1e-6);\r
\r
  // Optional domain warp (seeded) \u2014 jitter indices with tiled lattice lookups\r
  var wp = px;\r
  if (params.warpAmp > 0.0) {\r
    let ip0 = posToIntsForHash_tiled(pos, params.freq, params.xShift, params.yShift, params.zShift);\r
    let jx = hashToSigned01_seeded(ip0.x + 5u, ip0.y + 11u, ip0.z + 17u, seed);\r
    let jy = hashToSigned01_seeded(ip0.x + 19u, ip0.y + 23u, ip0.z + 29u, seed);\r
    let warpScale = params.warpAmp * pixelBase * 0.0025;\r
    wp = px + vec2<f32>(jx, jy) * warpScale;\r
  }\r
\r
  // Sample HF and LF bands using the tiled value noise (coords pre-scaled)\r
  let high = valueNoise2D_seeded(wp * highScale, 1.0, seed, 0.0, 0.0);\r
  let lowSample = valueNoise2D_seeded(wp * lowScale, 1.0, seed, 0.0, 0.0);\r
\r
  let suppress = max(params.gain, 0.0);\r
  var result = high - lowSample * suppress;\r
\r
  let contrastFactor = 2.0;\r
  result = result * contrastFactor;\r
  result = result * (1.0 / (1.0 + suppress));\r
\r
  let rClamped = clamp(result, -1.0, 1.0);\r
  return rClamped * 0.5 + 0.5;\r
}\r
\r
\r
\r
// Shared tiling constants\r
const WGX : u32 = 8u;\r
const WGY : u32 = 8u;\r
const TILE_W : u32 = WGX + 2u; // 1 texel halo on each side\r
const TILE_H : u32 = WGY + 2u;\r
\r
// Per-kernel workgroup tiles at module scope\r
var<workgroup> normalTile  : array<array<f32, TILE_W>, TILE_H>;\r
var<workgroup> normal8Tile : array<array<f32, TILE_W>, TILE_H>;\r
var<workgroup> volumeTile  : array<array<f32, TILE_W>, TILE_H>;\r
var<workgroup> sphereTile  : array<array<f32, TILE_W>, TILE_H>;\r
\r
// Height fetch \r
fn sampleHeight(x: i32, y: i32, z: i32) -> f32 { if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(x, y, clampZ(z)), 0).x; } return textureLoad(inputTex, vec2<i32>(x, y), frame.layerIndex, 0).x; } fn safeNormalize(v: vec3<f32>) -> vec3<f32> { let len2 = dot(v, v); if (len2 > 1e-12) { return v * inverseSqrt(len2); } return vec3<f32>(0.0, 0.0, 1.0); }\r
\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeNormal(@builtin(global_invocation_id) gid: vec3<u32>,\r
                 @builtin(local_invocation_id)  lid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let wMax = i32(frame.fullWidth)  - 1;\r
  let hMax = i32(frame.fullHeight) - 1;\r
\r
  let tx = i32(lid.x) + 1;\r
  let ty = i32(lid.y) + 1;\r
\r
  let cx = clamp(fx, 0, wMax);\r
  let cy = clamp(fy, 0, hMax);\r
\r
  // center\r
  normalTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);\r
\r
  // 1-texel halo\r
  if (lid.x == 0u)               { normalTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }\r
  if (lid.x == WGX - 1u)         { normalTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }\r
  if (lid.y == 0u)               { normalTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.y == WGY - 1u)         { normalTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }\r
  if (lid.x == 0u && lid.y == 0u) {\r
    normalTile[0u][0u]            = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == 0u) {\r
    normalTile[0u][TILE_W - 1u]   = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == 0u && lid.y == WGY - 1u) {\r
    normalTile[TILE_H - 1u][0u]   = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
    normalTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
\r
  workgroupBarrier();\r
\r
  // 4-neighbor central differences\r
  let zC = normalTile[u32(ty)][u32(tx)];\r
  let zL = normalTile[u32(ty)][u32(tx - 1)];\r
  let zR = normalTile[u32(ty)][u32(tx + 1)];\r
  let zD = normalTile[u32(ty - 1)][u32(tx)];\r
  let zU = normalTile[u32(ty + 1)][u32(tx)];\r
\r
  let dx = (zR - zL) * 0.5;\r
  let dy = (zU - zD) * 0.5;\r
\r
  let n   = normalize(vec3<f32>(dx, dy, 1.0));\r
  let enc = n * 0.5 + vec3<f32>(0.5);\r
\r
  // pack: .r = original height, .g = enc.y, .b = enc.x, .a = enc.z\r
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);\r
  storeRGBA(cx, cy, fz, outCol);\r
}\r
\r
// 8-neighbor filtered gradient using the same tile\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeNormal8(@builtin(global_invocation_id) gid: vec3<u32>,\r
                  @builtin(local_invocation_id)  lid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let wMax = i32(frame.fullWidth)  - 1;\r
  let hMax = i32(frame.fullHeight) - 1;\r
\r
  let tx = i32(lid.x) + 1;\r
  let ty = i32(lid.y) + 1;\r
\r
  let cx = clamp(fx, 0, wMax);\r
  let cy = clamp(fy, 0, hMax);\r
\r
  // center\r
  normal8Tile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);\r
\r
  // halo\r
  if (lid.x == 0u)                    { normal8Tile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }\r
  if (lid.x == WGX - 1u)              { normal8Tile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }\r
  if (lid.y == 0u)                    { normal8Tile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.y == WGY - 1u)              { normal8Tile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }\r
  if (lid.x == 0u && lid.y == 0u)     { normal8Tile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.x == WGX - 1u && lid.y == 0u) {\r
    normal8Tile[0u][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == 0u && lid.y == WGY - 1u) {\r
    normal8Tile[TILE_H - 1u][0u]      = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
    normal8Tile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
\r
  workgroupBarrier();\r
\r
  let zC  = normal8Tile[u32(ty)][u32(tx)];\r
  let zL  = normal8Tile[u32(ty)][u32(tx - 1)];\r
  let zR  = normal8Tile[u32(ty)][u32(tx + 1)];\r
  let zD  = normal8Tile[u32(ty - 1)][u32(tx)];\r
  let zU  = normal8Tile[u32(ty + 1)][u32(tx)];\r
  let zUL = normal8Tile[u32(ty + 1)][u32(tx - 1)];\r
  let zUR = normal8Tile[u32(ty + 1)][u32(tx + 1)];\r
  let zDL = normal8Tile[u32(ty - 1)][u32(tx - 1)];\r
  let zDR = normal8Tile[u32(ty - 1)][u32(tx + 1)];\r
\r
  let dx = ((zR + zUR + zDR) - (zL + zUL + zDL)) / 3.0;\r
  let dy = ((zU + zUR + zUL) - (zD + zDR + zDL)) / 3.0;\r
\r
  let n   = normalize(vec3<f32>(dx, dy, 1.0));\r
  let enc = n * 0.5 + vec3<f32>(0.5);\r
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);\r
  storeRGBA(cx, cy, fz, outCol);\r
}\r
\r
fn encode01(v: vec3<f32>) -> vec3<f32> {\r
    return v * 0.5 + vec3<f32>(0.5);\r
}\r
\r
// Volume normals: tile the XY plane and only sample Z neighbors per pixel\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeNormalVolume(@builtin(global_invocation_id) gid: vec3<u32>,\r
                       @builtin(local_invocation_id)  lid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let wMax = i32(frame.fullWidth)  - 1;\r
  let hMax = i32(frame.fullHeight) - 1;\r
\r
  let tx = i32(lid.x) + 1;\r
  let ty = i32(lid.y) + 1;\r
\r
  let cx = clamp(fx, 0, wMax);\r
  let cy = clamp(fy, 0, hMax);\r
\r
  // center slice values once per tile\r
  volumeTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);\r
  if (lid.x == 0u)                    { volumeTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }\r
  if (lid.x == WGX - 1u)              { volumeTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }\r
  if (lid.y == 0u)                    { volumeTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.y == WGY - 1u)              { volumeTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }\r
  if (lid.x == 0u && lid.y == 0u)     { volumeTile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.x == WGX - 1u && lid.y == 0u) {\r
    volumeTile[0u][TILE_W - 1u]       = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == 0u && lid.y == WGY - 1u) {\r
    volumeTile[TILE_H - 1u][0u]       = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
    volumeTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
\r
  workgroupBarrier();\r
\r
  let zC = volumeTile[u32(ty)][u32(tx)];\r
  let zL = volumeTile[u32(ty)][u32(tx - 1)];\r
  let zR = volumeTile[u32(ty)][u32(tx + 1)];\r
  let zD = volumeTile[u32(ty - 1)][u32(tx)];\r
  let zU = volumeTile[u32(ty + 1)][u32(tx)];\r
\r
  let dx = (zR - zL) * 0.5;\r
  let dy = (zU - zD) * 0.5;\r
\r
  let zB = sampleHeight(cx, cy, clampZ(fz - 1));\r
  let zF = sampleHeight(cx, cy, clampZ(fz + 1));\r
  let dz = (zF - zB) * 0.5;\r
\r
  let n   = safeNormalize(vec3<f32>(dx, dy, dz));\r
  let enc = encode01(n);\r
  storeRGBA(cx, cy, fz, vec4<f32>(enc, zC));\r
}\r
\r
\r
// Sphere normals with shared tile and wrapped longitude\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeSphereNormal(@builtin(global_invocation_id) gid: vec3<u32>,\r
                       @builtin(local_invocation_id)  lid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let w  = i32(frame.fullWidth);\r
    let h  = i32(frame.fullHeight);\r
\r
    // wrap longitude, clamp latitude\r
    let wrapX  = ((fx % w) + w) % w;\r
    let clampY = clamp(fy, 0, h - 1);\r
\r
    let tx = i32(lid.x) + 1;\r
    let ty = i32(lid.y) + 1;\r
\r
    // center\r
    sphereTile[u32(ty)][u32(tx)] =\r
        textureLoad(inputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, 0).x;\r
\r
    // halo\r
    if (lid.x == 0u) {\r
        let lx = ((wrapX - 1) % w + w) % w;\r
        sphereTile[u32(ty)][0u] =\r
            textureLoad(inputTex, vec2<i32>(lx, clampY), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == WGX - 1u) {\r
        let rx = ((wrapX + 1) % w + w) % w;\r
        sphereTile[u32(ty)][TILE_W - 1u] =\r
            textureLoad(inputTex, vec2<i32>(rx, clampY), frame.layerIndex, 0).x;\r
    }\r
    if (lid.y == 0u) {\r
        let dy = clamp(clampY - 1, 0, h - 1);\r
        sphereTile[0u][u32(tx)] =\r
            textureLoad(inputTex, vec2<i32>(wrapX, dy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.y == WGY - 1u) {\r
        let uy = clamp(clampY + 1, 0, h - 1);\r
        sphereTile[TILE_H - 1u][u32(tx)] =\r
            textureLoad(inputTex, vec2<i32>(wrapX, uy), frame.layerIndex, 0).x;\r
    }\r
    // corners\r
    if (lid.x == 0u && lid.y == 0u) {\r
        let lx = ((wrapX - 1) % w + w) % w;\r
        let dy = clamp(clampY - 1, 0, h - 1);\r
        sphereTile[0u][0u] =\r
            textureLoad(inputTex, vec2<i32>(lx, dy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == WGX - 1u && lid.y == 0u) {\r
        let rx = ((wrapX + 1) % w + w) % w;\r
        let dy = clamp(clampY - 1, 0, h - 1);\r
        sphereTile[0u][TILE_W - 1u] =\r
            textureLoad(inputTex, vec2<i32>(rx, dy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == 0u && lid.y == WGY - 1u) {\r
        let lx = ((wrapX - 1) % w + w) % w;\r
        let uy = clamp(clampY + 1, 0, h - 1);\r
        sphereTile[TILE_H - 1u][0u] =\r
            textureLoad(inputTex, vec2<i32>(lx, uy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
        let rx = ((wrapX + 1) % w + w) % w;\r
        let uy = clamp(clampY + 1, 0, h - 1);\r
        sphereTile[TILE_H - 1u][TILE_W - 1u] =\r
            textureLoad(inputTex, vec2<i32>(rx, uy), frame.layerIndex, 0).x;\r
    }\r
\r
    workgroupBarrier();\r
\r
    // fetch\r
    let baseH = sphereTile[u32(ty)][u32(tx)];\r
    let hL    = sphereTile[u32(ty)][u32(tx - 1)];\r
    let hR    = sphereTile[u32(ty)][u32(tx + 1)];\r
    let hD    = sphereTile[u32(ty - 1)][u32(tx)];\r
    let hU    = sphereTile[u32(ty + 1)][u32(tx)];\r
\r
    // radii\r
    let r0 = options.baseRadius + baseH * options.heightScale;\r
    let rL = options.baseRadius + hL    * options.heightScale;\r
    let rR = options.baseRadius + hR    * options.heightScale;\r
    let rD = options.baseRadius + hD    * options.heightScale;\r
    let rU = options.baseRadius + hU    * options.heightScale;\r
\r
    // spherical angles and increments\r
    let theta  = f32(clampY) / f32(h - 1) * PI;\r
    let phi    = f32(wrapX)  / f32(w - 1) * 2.0 * PI;\r
    let dTheta = PI / f32(h - 1);\r
    let dPhi   = 2.0 * PI / f32(w - 1);\r
\r
    // precompute sines and cosines\r
    let sTh  = sin(theta);\r
    let cTh  = cos(theta);\r
    let sPh  = sin(phi);\r
    let cPh  = cos(phi);\r
    let sThU = sin(theta + dTheta);\r
    let cThU = cos(theta + dTheta);\r
    let sPhE = sin(phi + dPhi);\r
    let cPhE = cos(phi + dPhi);\r
\r
    // positions on the sphere\r
    let p0 = vec3<f32>(r0 * sTh * cPh,\r
                       r0 * sTh * sPh,\r
                       r0 * cTh);\r
\r
    let pE = vec3<f32>(rR * sTh * cPhE,\r
                       rR * sTh * sPhE,\r
                       rR * cTh);\r
\r
    let pN = vec3<f32>(rU * sThU * cPh,\r
                       rU * sThU * sPh,\r
                       rU * cThU);\r
\r
    // normal\r
    let tE = pE - p0;\r
    let tN = pN - p0;\r
    let n  = normalize(cross(tE, tN));\r
    let enc = n * 0.5 + vec3<f32>(0.5);\r
\r
    // pack and store\r
    let outCol = vec4<f32>(baseH, enc.x, enc.y, enc.z);\r
    textureStore(outputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, outCol);\r
}\r
\r
\r
// Texture clear to reset channel(s)\r
@compute @workgroup_size(8, 8, 1)\r
fn clearTexture(@builtin(global_invocation_id) gid : vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  writeChannel(fx, fy, fz, 0.0, options.outputChannel, 1u);\r
}\r
\r
// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\r
// 0) Perlin\r
// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\r
@compute @workgroup_size(8, 8, 1)\r
fn computePerlin(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of Perlin noise\r
    let v0 = generatePerlin(p, params);\r
\r
    // add it into the selected channel (or all channels) of the output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 0.1) Perlin 4D (fBM using time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computePerlin4D(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel (w comes from params.time inside the generator)\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of 4D Perlin fBM (uses params.time as 4th dim)\r
    let v0 = generatePerlin4D(p, params);\r
\r
    // write into output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 1) Billow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 2) AntiBillow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 3) Ridge\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidge(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidge(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 4) AntiRidge\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidge(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidge(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 5) RidgedMultifractal\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 6) RidgedMultifractal2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 7) RidgedMultifractal3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 8) RidgedMultifractal4\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal4(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 9) AntiRidgedMultifractal\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 10) AntiRidgedMultifractal2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 11) AntiRidgedMultifractal3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 12) AntiRidgedMultifractal4\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal4(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 13) FBM (2\xB7simplex chain)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFBM(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFBM(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 14) FBM2 (chain+zoom FBM)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFBM2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFBM2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 15) FBM3 (three-stage FBM chain)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFBM3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFBM3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 16) CellularBM1\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM1(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellularBM1(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 17) CellularBM2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellularBM2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 18) CellularBM3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellularBM3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 19) VoronoiBM1\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM1(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiBM1(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 20) VoronoiBM2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiBM2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 21) VoronoiBM3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiBM3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 22) Cellular\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellular(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellular(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
  22.1) AntiCellular\r
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiCellular(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiCellular(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 22.2) Cellular\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellular4D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
  22.3) AntiCellular\r
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiCellular4D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 23) Worley\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorley(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateWorley(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
  23.1) AntiWorley\r
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiWorley(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiWorley(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 23.2) Worley 4D (fBM using time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel (w comes from params.time inside the generator)\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)\r
    let v0 = generateWorley4D(p, params);\r
\r
    // write into output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 23.3) Worley 4D (fBM using time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel (w comes from params.time inside the generator)\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)\r
    let v0 = generateAntiWorley4D(p, params);\r
\r
    // write into output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// Worley 4D BM variants (time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM1_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM2_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM3_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM1_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM2_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM3_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// Cellular 4D BM variants (time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM1_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM2_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM3_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM1_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM2_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM3_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 24) VoronoiTileNoise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiTileNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiTileNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 25) LanczosBillow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeLanczosBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateLanczosBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 26) LanczosAntiBillow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeLanczosAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateLanczosAntiBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 27) Voronoi Circle-Gradient Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiCircleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiCircleNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 28) Voronoi Circle-Gradient Tile Noise 2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiCircle2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiCircle2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 29) Voronoi Flat-Shade Tile Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiFlatShade(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiFlatShade(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 30) Voronoi Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiRipple3D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 31) Voronoi Ripple 3D 2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiRipple3D2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiRipple3D2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 32) Voronoi Circular Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiCircularRipple(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 33) Fractal Voronoi Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFVoronoiRipple3D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 34) Fractal Voronoi Circular Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFVoronoiCircularRipple(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 35) Ripple Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRippleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRippleNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 36) Fractal Ripples\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFractalRipples(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFractalRipples(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 37) HexWorms\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeHexWorms(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateHexWormsNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 38) PerlinWorms\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computePerlinWorms(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generatePerlinWormsNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 39) White Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWhiteNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateWhiteNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 40) Blue Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeBlueNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateBlueNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// 41) Simplex\r
@compute @workgroup_size(8,8,1)\r
fn computeSimplex(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  let v0 = generateSimplex(p, params);\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeSimplexFBM(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  let v0 = generateSimplexFBM(p, params);\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeCurl2D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let pos = fetchPos(fx, fy, fz).xy;\r
  let v   = curl2_simplex2D(pos, params);\r
  // gentle gain so it doesn\u2019t clip hard; tweak 0.75 if you like\r
  let m   = mag_to_signed01(length(v) * 0.75);\r
\r
  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeCurlFBM2D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let pos = fetchPos(fx, fy, fz).xy;\r
  let v   = curl2_simplexFBM(pos, params);\r
  let m   = mag_to_signed01(length(v) * 0.75);\r
\r
  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeDomainWarpFBM1(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM1(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeDomainWarpFBM2(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM2(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeGaborAnisotropic(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateGaborAniso(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeTerraceNoise(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTerraceNoise(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeFoamNoise(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateFoamNoise(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeTurbulence(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTurbulence(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateAntiBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeLanczosBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateLanczosBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeLanczosAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateLanczosAntiBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeFBM4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateFBM4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeVoronoi4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoi4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeTerraceNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTerraceNoise4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFoamNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateFoamNoise4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeTurbulence4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTurbulence4D(p, params), options.outputChannel, 0u);\r
}\r
\r
\r
\r
// too slow to compile all at once due to branching, had to write new entry point logic\r
// fn computeMixedNoise(pos : vec3<f32>) -> f32 {\r
//     var result   : f32 = 0.0;\r
//     var paramIdx : u32 = 0u;\r
\r
//     // copy the mask so we can eat bits out of it\r
//     var bits : u32 = options.mask;\r
\r
//     // while there's still a set bit, handle just that one\r
//     loop {\r
//         // bail as soon as we've consumed all bits\r
//         if (bits == 0u) {\r
//             break;\r
//         }\r
\r
//         // find the lowest set bit index\r
//         let i : u32 = firstTrailingBit(bits);\r
\r
//         // clear that bit so next iteration finds the next one\r
//         bits = bits & (bits - 1u);\r
\r
//         // load this algo's params\r
//         let p = params[paramIdx];\r
//         paramIdx = paramIdx + 1u;\r
\r
//         // dispatch the one selected generator\r
//         var v : f32 = 0.0;\r
//         switch(i) {\r
//             case 0u:  { v = generatePerlin(pos, p); }\r
//             // case 1u:  { v = generateBillow(pos, p); }\r
//             // case 2u:  { v = generateAntiBillow(pos, p); }\r
//             // case 3u:  { v = generateRidge(pos, p); }\r
//             // case 4u:  { v = generateAntiRidge(pos, p); }\r
//             // case 5u:  { v = generateRidgedMultifractal(pos, p); }\r
//             // case 6u:  { v = generateRidgedMultifractal2(pos, p); }\r
//             // case 7u:  { v = generateRidgedMultifractal3(pos, p); }\r
//             // case 8u:  { v = generateRidgedMultifractal4(pos, p); }\r
//             // case 9u:  { v = generateAntiRidgedMultifractal(pos, p); }\r
//             // case 10u: { v = generateAntiRidgedMultifractal2(pos, p); }\r
//             // case 11u: { v = generateAntiRidgedMultifractal3(pos, p); }\r
//             // case 12u: { v = generateAntiRidgedMultifractal4(pos, p); }\r
//             // case 13u: { v = generateFBM(pos, p); }\r
//             // case 14u: { v = generateFBM2(pos, p); }\r
//             // case 15u: { v = generateFBM3(pos, p); }\r
//             // case 16u: { v = generateCellularBM1(pos, p); }\r
//             // case 17u: { v = generateCellularBM2(pos, p); }\r
//             // case 18u: { v = generateCellularBM3(pos, p); }\r
//             // case 19u: { v = generateVoronoiBM1(pos, p); }\r
//             // case 20u: { v = generateVoronoiBM2(pos, p); }\r
//             // case 21u: { v = generateVoronoiBM3(pos, p); }\r
//             // case 22u: { v = generateCellular(pos, p); }\r
//             // case 23u: { v = generateWorley(pos, p); }\r
//             // case 24u: { v = generateVoronoiTileNoise(pos, p); }\r
//             // case 25u: { v = generateLanczosBillow(pos, p); }\r
//             // case 26u: { v = generateLanczosAntiBillow(pos, p); }\r
//             //todo port the rest, also more generic ones like white/blue noise\r
//             default:  { /* unsupported bit \u2192 no contribution */ }\r
//         }\r
\r
//         result = result + v;\r
\r
//         // stop if we've reached the max slots you filled\r
//         if (paramIdx >= MAX_NOISE_CONFIGS) {\r
//             break;\r
//         }\r
//     }\r
\r
//     return result;\r
// }\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Compute Entry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// @compute @workgroup_size(8, 8, 1)\r
// fn main(@builtin(global_invocation_id) gid : vec3<u32>) {\r
//     // 2) compute absolute pixel coords in the full output\r
//     let fx = i32(frame.originX) + i32(gid.x);\r
//     let fy = i32(frame.originY) + i32(gid.y);\r
//     let p = fetchPos(fx, fy);\r
\r
//     // 4) compute the mixed noise height\r
//     let h = computeMixedNoise(p);\r
\r
//     // 5) (optional) finite-difference normal\r
//     var out: vec4<f32>;\r
//     if (options.getGradient == 1u) {\r
//         // let ex = options.epsilon.x;\r
//         // let ey = options.epsilon.y;\r
//         // let ez = options.epsilon.z;\r
\r
//         // let hx = computeMixedNoise(p + vec3<f32>(ex, 0.0, 0.0));\r
//         // let lx = computeMixedNoise(p - vec3<f32>(ex, 0.0, 0.0));\r
//         // let hy = computeMixedNoise(p + vec3<f32>(0.0, ey, 0.0));\r
//         // let ly = computeMixedNoise(p - vec3<f32>(0.0, ey, 0.0));\r
//         // let hz = computeMixedNoise(p + vec3<f32>(0.0, 0.0, ez));\r
//         // let lz = computeMixedNoise(p - vec3<f32>(0.0, 0.0, ez));\r
\r
//         // var dx = (hx - lx) / (2.0 * ex);\r
//         // var dy = (hy - ly) / (2.0 * ey);\r
//         // var dz = (hz - lz) / (2.0 * ez);\r
//         // let invLen = 1.0 / max(1e-6, sqrt(dx*dx + dy*dy + dz*dz));\r
//         // dx *= invLen; dy *= invLen; dz *= invLen;\r
\r
//         // out = vec4<f32>(h, dx, dy, dz);\r
//     } else {\r
//         out = vec4<f32>(h, h, h, h);\r
//     }\r
\r
//   // 6) write into the layer of the 2D-array texture\r
//   textureStore(\r
//     outputTex,\r
//     vec2<i32>(fx, fy),\r
//     frame.layerIndex,      \r
//     out\r
//   );\r
// }\r
\r
\r
\r
// 5x5 Gaussian blur (separable weights via shared tile, single-pass)\r
// Applies per-channel convolution on RGBA and writes rgba16f\r
// If options.outputChannel == 0, writes all channels\r
// If 1..4, only that channel is replaced with blurred value, others copied from source\r
\r
const WG_X : u32 = 16u;\r
const WG_Y : u32 = 16u;\r
const R    : u32 = 2u;        // kernel radius for 5x5\r
const TILE_SIZE : u32 = TILE_W * TILE_H;\r
\r
const G5 : array<f32, 5> = array<f32,5>(1.0, 4.0, 6.0, 4.0, 1.0);\r
const G5NORM : f32 = 1.0 / 256.0;\r
\r
var<workgroup> tileRGBA : array<vec4<f32>, TILE_SIZE>;\r
\r
fn tileIndex(x: u32, y: u32)->u32 {\r
  return y * TILE_W + x;\r
}\r
\r
@compute @workgroup_size(WG_X, WG_Y, 1)\r
fn computeGauss5x5(\r
  @builtin(local_invocation_id)  lid: vec3<u32>,\r
  @builtin(workgroup_id)         wid: vec3<u32>,\r
  @builtin(global_invocation_id) gid: vec3<u32>\r
){\r
  // Workgroup top-left in full image space\r
  let wgOx = i32(frame.originX) + i32(wid.x) * i32(WG_X);\r
  let wgOy = i32(frame.originY) + i32(wid.y) * i32(WG_Y);\r
  let fz   = i32(frame.originZ) + i32(gid.z);\r
\r
  // Cooperatively load a (WG_X+4) x (WG_Y+4) tile with a 2px halo\r
  var ty: u32 = lid.y;\r
  loop {\r
    if (ty >= TILE_H) { break; }\r
    var tx: u32 = lid.x;\r
    loop {\r
      if (tx >= TILE_W) { break; }\r
      let sx = clamp(wgOx + i32(tx) - i32(R), 0, i32(frame.fullWidth)  - 1);\r
      let sy = clamp(wgOy + i32(ty) - i32(R), 0, i32(frame.fullHeight) - 1);\r
      tileRGBA[tileIndex(tx, ty)] = loadPrevRGBA(sx, sy, fz);\r
      tx += WG_X;\r
    }\r
    ty += WG_Y;\r
  }\r
  workgroupBarrier();\r
\r
  // Output pixel this thread is responsible for\r
  let fx = wgOx + i32(lid.x);\r
  let fy = wgOy + i32(lid.y);\r
\r
  // Guard writes that might fall off the image on the final groups\r
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {\r
    return;\r
  }\r
\r
  // Center within the shared tile\r
  let txc = u32(lid.x) + R;\r
  let tyc = u32(lid.y) + R;\r
\r
  // 5x5 Gaussian using separable weights via outer product on the tile\r
  var acc : vec4<f32> = vec4<f32>(0.0);\r
  for (var j: u32 = 0u; j < 5u; j = j + 1u) {\r
    let wy = G5[j];\r
    let tyN = u32(i32(tyc) + i32(j) - 2);\r
    for (var i: u32 = 0u; i < 5u; i = i + 1u) {\r
      let wx = G5[i];\r
      let txN = u32(i32(txc) + i32(i) - 2);\r
      let w = (wx * wy) * G5NORM;\r
      acc += tileRGBA[tileIndex(txN, tyN)] * w;\r
    }\r
  }\r
\r
  // Channel selection: 0 -> write all, 1..4 -> replace that channel only\r
  var outCol = acc;\r
  if (options.outputChannel != 0u) {\r
    let src = loadPrevRGBA(fx, fy, fz);\r
    let c = options.outputChannel;\r
    outCol = src;\r
    if (c == 1u) { outCol.x = acc.x; }\r
    else if (c == 2u) { outCol.y = acc.y; }\r
    else if (c == 3u) { outCol.z = acc.z; }\r
    else if (c == 4u) { outCol.w = acc.w; }\r
  }\r
\r
  storeRGBA(fx, fy, fz, outCol);\r
}\r
`;var oe=`// Fullscreen quad (module-scope constant)\r
const kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r
  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r
  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r
);\r
\r
struct VsOut {\r
  @builtin(position) pos : vec4<f32>,\r
  @location(0)       uv  : vec2<f32>,\r
};\r
\r
@vertex\r
fn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r
  let p = kQuad[i];\r
\r
  var o : VsOut;\r
  o.pos = vec4<f32>(p, 0.0, 1.0);\r
  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r
  return o;\r
}\r
\r
@group(0) @binding(0) var samp : sampler;\r
@group(0) @binding(1) var tex  : texture_2d_array<f32>;\r
\r
struct UBlit2D {\r
  layer   : u32,\r
  channel : u32,\r
  _pad0   : u32,\r
  _pad1   : u32,\r
};\r
@group(0) @binding(2) var<uniform> U : UBlit2D;\r
\r
@fragment\r
fn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r
  // For array textures the signature is (tex, sampler, uv, arrayIndex, level)\r
  let c = textureSampleLevel(tex, samp, in.uv, i32(U.layer), 0.0);\r
\r
  // display a single channel directly\r
  var v = c.r;\r
  if (U.channel == 2u) { v = c.g; }\r
  if (U.channel == 3u) { v = c.b; }\r
  if (U.channel == 4u) { v = c.a; }\r
\r
  return vec4<f32>(clamp(v, 0.0, 1.0));\r
}\r
`;var ne=`const kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r
  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r
  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r
);\r
\r
struct VsOut {\r
  @builtin(position) pos : vec4<f32>,\r
  @location(0)       uv  : vec2<f32>,\r
};\r
\r
@vertex\r
fn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r
  let p = kQuad[i];\r
  var o : VsOut;\r
  o.pos = vec4<f32>(p, 0.0, 1.0);\r
  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r
  return o;\r
}\r
\r
@group(0) @binding(0) var samp : sampler;\r
@group(0) @binding(1) var tex3d : texture_3d<f32>;\r
\r
struct UBlit3D {\r
  zNorm   : f32,  // normalized depth [0..1]\r
  channel : u32,\r
  _pad0   : u32,\r
  _pad1   : u32,\r
};\r
@group(0) @binding(2) var<uniform> U : UBlit3D;\r
\r
@fragment\r
fn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r
  let coord = vec3<f32>(in.uv, clamp(U.zNorm, 0.0, 1.0));\r
  let c = textureSample(tex3d, samp, coord);\r
\r
  // display a single channel directly\r
  var v = c.r;\r
  if (U.channel == 2u) { v = c.g; }\r
  if (U.channel == 3u) { v = c.b; }\r
  if (U.channel == 4u) { v = c.a; }\r
\r
  return vec4<f32>(clamp(v, 0.0, 1.0));\r
}\r
`;var ze=4096;var se=2048,Ie=8,re=class{constructor(t,e){this.device=t,this.queue=e,this.maxBufferChunkBytes=8e6,this.entryPoints=["computePerlin","computeBillow","computeAntiBillow","computeRidge","computeAntiRidge","computeRidgedMultifractal","computeRidgedMultifractal2","computeRidgedMultifractal3","computeRidgedMultifractal4","computeAntiRidgedMultifractal","computeAntiRidgedMultifractal2","computeAntiRidgedMultifractal3","computeAntiRidgedMultifractal4","computeFBM","computeFBM2","computeFBM3","computeCellularBM1","computeCellularBM2","computeCellularBM3","computeVoronoiBM1","computeVoronoiBM2","computeVoronoiBM3","computeCellular","computeWorley","computeAntiCellular","computeAntiWorley","computeLanczosBillow","computeLanczosAntiBillow","computeVoronoiTileNoise","computeVoronoiCircleNoise","computeVoronoiCircle2","computeVoronoiFlatShade","computeVoronoiRipple3D","computeVoronoiRipple3D2","computeVoronoiCircularRipple","computeFVoronoiRipple3D","computeFVoronoiCircularRipple","computeRippleNoise","computeFractalRipples","computeHexWorms","computePerlinWorms","computeWhiteNoise","computeBlueNoise","computeSimplex","computeSimplexFBM","computeCurl2D","computeCurlFBM2D","computeDomainWarpFBM1","computeDomainWarpFBM2","computeGaborAnisotropic","computeTerraceNoise","computeFoamNoise","computeTurbulence","computePerlin4D","computeWorley4D","computeAntiWorley4D","computeCellular4D","computeAntiCellular4D","computeBillow4D","computeAntiBillow4D","computeLanczosBillow4D","computeLanczosAntiBillow4D","computeFBM4D","computeVoronoi4D","computeVoronoiBM1_4D","computeVoronoiBM2_4D","computeVoronoiBM3_4D","computeVoronoiBM1_4D_vec","computeVoronoiBM2_4D_vec","computeVoronoiBM3_4D_vec","computeWorleyBM1_4D","computeWorleyBM2_4D","computeWorleyBM3_4D","computeWorleyBM1_4D_vec","computeWorleyBM2_4D_vec","computeWorleyBM3_4D_vec","computeCellularBM1_4D","computeCellularBM2_4D","computeCellularBM3_4D","computeCellularBM1_4D_vec","computeCellularBM2_4D_vec","computeCellularBM3_4D_vec","computeTerraceNoise4D","computeFoamNoise4D","computeTurbulence4D","computeGauss5x5","computeNormal","computeNormal8","computeSphereNormal","computeNormalVolume","clearTexture"],this.shaderModule=t.createShaderModule({code:be}),this.bindGroupLayout=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"2d-array"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:7,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"3d"}},{binding:8,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"3d"}}]}),this.pipelineLayout=t.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),this.pipelines=new Map,this._texPairs=new Map,this._tid=null,this._tag=new WeakMap,this._volumeCache=new Map,this.viewA=null,this.viewB=null,this.width=0,this.height=0,this.layers=1,this.isA=!0,this._initBuffers(),this._ensureDummies(),this._ctxMap=new WeakMap}_initBuffers(){this.optionsBuffer?.destroy(),this.paramsBuffer?.destroy(),this.permBuffer?.destroy(),this.nullPosBuffer?.destroy(),this.optionsBuffer=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.paramsBuffer=this.device.createBuffer({size:88,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.permBuffer=this.device.createBuffer({size:512*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.nullPosBuffer=this.device.createBuffer({size:64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.queue.writeBuffer(this.optionsBuffer,0,new ArrayBuffer(32)),this.queue.writeBuffer(this.paramsBuffer,0,new ArrayBuffer(88)),this.queue.writeBuffer(this.permBuffer,0,new Uint32Array(512))}_ensureDummies(){this._dummy2D_sampleTex||(this._dummy2D_sampleTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this._dummy2D_sampleView=this._dummy2D_sampleTex.createView({dimension:"2d-array",arrayLayerCount:1})),this._dummy2D_writeTex||(this._dummy2D_writeTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST}),this._dummy2D_writeView=this._dummy2D_writeTex.createView({dimension:"2d-array",arrayLayerCount:1})),this._dummy3D_sampleTex||(this._dummy3D_sampleTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this._dummy3D_sampleView=this._dummy3D_sampleTex.createView({dimension:"3d"})),this._dummy3D_writeTex||(this._dummy3D_writeTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST}),this._dummy3D_writeView=this._dummy3D_writeTex.createView({dimension:"3d"}))}_getMaxBufferChunkBytes(t){let e=this.device?.limits?.maxBufferSize??268435456,i=Math.max(1024*1024,Math.floor(e*.9)),r=Number.isFinite(t)?Math.floor(t):this.maxBufferChunkBytes;return(!Number.isFinite(r)||r<=0)&&(r=this.maxBufferChunkBytes),r=Math.max(4,r)&-4,Math.min(i,r)}_writeBufferChunked(t,e,i,r,a,o=null){let l=a|0;if(!(l>0))return;let s=this._getMaxBufferChunkBytes(o),f=0;for(;f<l;){let p=Math.min(s,l-f)|0;if(p=p&-4,p<=0)break;this.queue.writeBuffer(t,e+f|0,i,r+f|0,p),f=f+p|0}if(f!==l)throw new Error(`_writeBufferChunked: incomplete write ${f}/${l} bytes`)}async _readBGRA8TextureToRGBA8Pixels(t,e,i,r={}){let a=Math.max(1,e|0),o=Math.max(1,i|0),l=4,s=256,f=a*l,p=Math.ceil(f/s)*s,u=this.device?.limits?.maxBufferSize??256*1024*1024,m=Math.max(1024*1024,Math.floor(u*.9)),h=this._getMaxBufferChunkBytes(r.maxBufferChunkBytes);if(h<p&&(h=p),p>m)throw new Error(`_readBGRA8TextureToRGBA8Pixels: bytesPerRow=${p} exceeds safe buffer cap=${m}`);let c=Math.max(1,Math.floor(h/p))|0,d=new Uint8ClampedArray(a*o*4),v=[],b=this.device.createCommandEncoder();for(let y=0;y<o;y+=c){let z=Math.min(c,o-y)|0,M=p*z|0,D=this.device.createBuffer({size:M,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});b.copyTextureToBuffer({texture:t,origin:{x:0,y,z:0}},{buffer:D,bytesPerRow:p,rowsPerImage:z},{width:a,height:z,depthOrArrayLayers:1}),v.push({readBuffer:D,y0:y,rows:z})}if(this.queue.submit([b.finish()]),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch{}for(let y of v){let{readBuffer:z,y0:M,rows:D}=y;await z.mapAsync(GPUMapMode.READ);let w=z.getMappedRange(),S=new Uint8Array(w);for(let q=0;q<D;q++){let C=q*p,N=(M+q)*a*4;for(let E=0;E<a;E++){let B=C+E*4,F=N+E*4;d[F+0]=S[B+2],d[F+1]=S[B+1],d[F+2]=S[B+0],d[F+3]=S[B+3]}}z.unmap(),z.destroy()}return d}resize(t){this.maxConfigs=t,this._initBuffers()}setPermTable(t){this.queue.writeBuffer(this.permBuffer,0,t)}setPosBuffer(t){this.posBuffer=t}setInputTextureView(t){try{if(((t?.texture?.usage??0)&GPUTextureUsage.TEXTURE_BINDING)===0){console.warn("setInputTextureView: provided texture view not created with TEXTURE_BINDING; ignoring.");return}}catch{}if(this.inputTextureView=t,this._tid!==null){let e=this._texPairs.get(this._tid);e&&(e.bindGroupDirty=!0)}}setOutputTextureView(t){try{if(((t?.texture?.usage??0)&GPUTextureUsage.STORAGE_BINDING)===0){console.warn("setOutputTextureView: provided texture view not created with STORAGE_BINDING; ignoring.");return}}catch{}if(this.outputTextureView=t,this._tid!==null){let e=this._texPairs.get(this._tid);e&&(e.bindGroupDirty=!0)}}buildPermTable(t=Date.now()){let i=new le(t).perm,r=new Uint32Array(512);for(let a=0;a<512;a++)r[a]=i[a];this.setPermTable(r)}setOptions(t={}){Array.isArray(t.noiseChoices)?this.noiseChoices=t.noiseChoices:this.noiseChoices||(this.noiseChoices=[0]);let{getGradient:e=0,outputChannel:i=1,baseRadius:r=0,heightScale:a=1,useCustomPos:o=0,ioFlags:l=0}=t;this.useCustomPos=o>>>0;let s=new ArrayBuffer(32),f=new DataView(s);f.setUint32(0,e,!0),f.setUint32(4,this.useCustomPos,!0),f.setUint32(8,i,!0),f.setUint32(12,l>>>0,!0),f.setFloat32(16,r,!0),f.setFloat32(20,a,!0),f.setFloat32(24,0,!0),f.setFloat32(28,0,!0),this.queue.writeBuffer(this.optionsBuffer,0,s);for(let p of this._texPairs.values())p.bindGroupDirty=!0}setNoiseParams(t={}){let e=t||{},i=this._lastNoiseParams||{},r=Object.prototype.hasOwnProperty,a=(P,I)=>{let g=r.call(e,P)?e[P]:i[P],x=Number(g);if(Number.isFinite(x))return x;let _=Number(I);return Number.isFinite(_)?_:0},o=(P,I)=>{let g=r.call(e,P)?e[P]:i[P],x=Number(g);if(Number.isFinite(x))return x>>>0;let _=Number(I);return Number.isFinite(_)?_>>>0:0},l=(P,I)=>{let g=r.call(e,P)?e[P]:i[P],x=Number(g);if(Number.isFinite(x))return x|0;let _=Number(I);return Number.isFinite(_)?_|0:0},s=(P,I)=>{let g=r.call(e,P)?e[P]:i[P];return g===void 0?(I?1:0)>>>0:(g?1:0)>>>0},f=l("seed",i.seed??Date.now()|0),p=a("zoom",i.zoom??1),u=a("freq",i.freq??1),m=Math.max(p||0,1e-6),h=Math.max(u||0,1e-6),c=o("octaves",i.octaves??8),d=s("turbulence",i.turbulence??0),v=a("lacunarity",i.lacunarity??2),b=a("gain",i.gain??.5),y=a("xShift",i.xShift??0),z=a("yShift",i.yShift??0),M=a("zShift",i.zShift??0),D=a("seedAngle",i.seedAngle??0),w=a("exp1",i.exp1??1),S=a("exp2",i.exp2??0),q=a("threshold",i.threshold??.1),C=a("rippleFreq",i.rippleFreq??10),N=a("time",i.time??0),E=a("warpAmp",i.warpAmp??.5),B=a("gaborRadius",i.gaborRadius??4),F=a("terraceStep",i.terraceStep??8),V=s("toroidal",i.toroidal??0),L=o("voroMode",i.voroMode??0),U=a("edgeK",i.edgeK??0),W=new ArrayBuffer(88),A=new DataView(W),T=0;A.setUint32(T+0,f>>>0,!0),A.setFloat32(T+4,m,!0),A.setFloat32(T+8,h,!0),A.setUint32(T+12,c>>>0,!0),A.setFloat32(T+16,v,!0),A.setFloat32(T+20,b,!0),A.setFloat32(T+24,y,!0),A.setFloat32(T+28,z,!0),A.setFloat32(T+32,M,!0),A.setUint32(T+36,d>>>0,!0),A.setFloat32(T+40,D,!0),A.setFloat32(T+44,w,!0),A.setFloat32(T+48,S,!0),A.setFloat32(T+52,q,!0),A.setFloat32(T+56,C,!0),A.setFloat32(T+60,N,!0),A.setFloat32(T+64,E,!0),A.setFloat32(T+68,B,!0),A.setFloat32(T+72,F,!0),A.setUint32(T+76,V>>>0,!0),A.setUint32(T+80,L>>>0,!0),A.setFloat32(T+84,U,!0),this.queue.writeBuffer(this.paramsBuffer,0,W),this._lastNoiseParams={seed:f,zoom:m,freq:h,octaves:c,lacunarity:v,gain:b,xShift:y,yShift:z,zShift:M,turbulence:d,seedAngle:D,exp1:w,exp2:S,threshold:q,rippleFreq:C,time:N,warpAmp:E,gaborRadius:B,terraceStep:F,toroidal:V,voroMode:L,edgeK:U};for(let P of this._texPairs.values())P.bindGroupDirty=!0;for(let[P,I]of this._volumeCache)!I||!Array.isArray(I.chunks)||(I._bindGroupsDirty=!0)}_numOr0(t){let e=Number(t);return Number.isFinite(e)?e:0}_resolveScroll2D(t,e,i,r,a,o){let l=t||{},s=Math.max(1,e|0),f=Math.max(1,i|0),p=Math.max(1,(r??s)|0),u=Math.max(1,(a??f)|0),m=o?p:s,h=o?u:f,c=this._numOr0(l.offsetX)*m,d=this._numOr0(l.offsetY)*h,v=c+this._numOr0(l.offsetXf)+this._numOr0(l.originXf)+this._numOr0(l.originX),b=d+this._numOr0(l.offsetYf)+this._numOr0(l.originYf)+this._numOr0(l.originY);return{baseXf:v,baseYf:b}}_resolveScroll3D(t,e,i,r){let a=t||{},o=Math.max(1,e|0),l=Math.max(1,i|0),s=Math.max(1,r|0),f=this._numOr0(a.offsetX)*o,p=this._numOr0(a.offsetY)*l,u=this._numOr0(a.offsetZ)*s,m=f+this._numOr0(a.offsetXf)+this._numOr0(a.originXf)+this._numOr0(a.originX),h=p+this._numOr0(a.offsetYf)+this._numOr0(a.originYf)+this._numOr0(a.originY),c=u+this._numOr0(a.offsetZf)+this._numOr0(a.originZf)+this._numOr0(a.originZ),d=Math.floor(c)|0;return{baseXf:m,baseYf:h,baseZ:d}}_update2DTileFrames(t,e={}){let i=this._texPairs.get(t);if(!i||!Array.isArray(i.tiles)||i.tiles.length===0)return;let r=Number.isFinite(e.frameFullWidth)?e.frameFullWidth>>>0:i.fullWidth,a=Number.isFinite(e.frameFullHeight)?e.frameFullHeight>>>0:i.fullHeight,o=e.squareWorld||String(e.worldMode||"").toLowerCase()==="crop";if(e.squareWorld){let h=Math.max(r,a,i.fullWidth,i.fullHeight)>>>0;r=h,a=h}let l=i.fullWidth>>>0,s=i.fullHeight>>>0,{baseXf:f,baseYf:p}=this._resolveScroll2D(e,l,s,r,a,o),u=o?1:r/Math.max(1,l),m=o?1:a/Math.max(1,s);for(let h of i.tiles){let c=h?.frames?.[0];if(!c)continue;let d=h.originX|0,v=h.originY|0,b=(d+f)*u,y=(v+p)*m,z=r>0?b/r:0,M=a>0?y/a:0;this._writeFrameUniform(c,{fullWidth:r,fullHeight:a,tileWidth:i.tileWidth,tileHeight:i.tileHeight,originX:d,originY:v,originZ:0,fullDepth:1,tileDepth:1,layerIndex:h.layerIndex|0,layers:i.layers>>>0,originXf:z,originYf:M})}}_update3DChunkFrames(t,e=null,i={}){if(!t||!Array.isArray(t.chunks)||t.chunks.length===0)return;let r=e&&Number.isFinite(e?.w)?e.w>>>0:t.full.w,a=e&&Number.isFinite(e?.h)?e.h>>>0:t.full.h,o=e&&Number.isFinite(e?.d)?e.d>>>0:t.full.d,l=t.full.w>>>0,s=t.full.h>>>0,f=t.full.d>>>0,{baseXf:p,baseYf:u,baseZ:m}=this._resolveScroll3D(i,l,s,f),h=r/Math.max(1,l),c=a/Math.max(1,s);for(let d of t.chunks){d.fb||(d.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));let v=((d.ox|0)+p)*h,b=((d.oy|0)+u)*c,y=r>0?v/r:0,z=a>0?b/a:0,M=(d.oz|0)+m|0;this._writeFrameUniform(d.fb,{fullWidth:r,fullHeight:a,tileWidth:d.w,tileHeight:d.h,originX:d.ox|0,originY:d.oy|0,originZ:M,fullDepth:o,tileDepth:d.d,layerIndex:0,layers:1,originXf:y,originYf:z})}}_compute2DTiling(t,e){let i=Math.min(t,ze),r=Math.min(e,ze),a=Math.ceil(t/i),o=Math.ceil(e/r),l=a*o;return{tileW:i,tileH:r,tilesX:a,tilesY:o,layers:l}}_create2DPair(t,e){let i=this._compute2DTiling(t,e),r=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST,a=()=>this.device.createTexture({size:[i.tileW,i.tileH,i.layers],format:"rgba16float",usage:r}),o={dimension:"2d-array",arrayLayerCount:i.layers},l=a(),s=a(),f=l.createView(o),p=s.createView(o);l.label=`2D texA ${t}x${e}x${i.layers}`,s.label=`2D texB ${t}x${e}x${i.layers}`,f.label="2D:viewA",p.label="2D:viewB",this._tag.set(f,"2D:A"),this._tag.set(p,"2D:B");let u=this._texPairs.size;return this._texPairs.set(u,{texA:l,texB:s,viewA:f,viewB:p,fullWidth:t,fullHeight:e,tileWidth:i.tileW,tileHeight:i.tileH,tilesX:i.tilesX,tilesY:i.tilesY,layers:i.layers,isA:!0,tiles:null,bindGroupDirty:!0}),this._tid===null&&this.setActiveTexture(u),u}createShaderTextures(t,e){this._tid!==null&&this._texPairs.has(this._tid)&&this.destroyTexturePair(this._tid);let i=this._create2DPair(t,e);return this.setActiveTexture(i),i}destroyTexturePair(t){let e=this._texPairs.get(t);if(e){try{e.texA.destroy()}catch{}try{e.texB.destroy()}catch{}if(Array.isArray(e.tiles))for(let i of e.tiles){if(Array.isArray(i.frames))for(let r of i.frames)try{r.destroy()}catch{}if(i.posBuf&&i.posBuf!==this.nullPosBuffer)try{i.posBuf.destroy()}catch{}}this._texPairs.delete(t),this._tid===t&&(this._tid=null,this.inputTextureView=null,this.outputTextureView=null,this.viewA=null,this.viewB=null)}}destroyAllTexturePairs(){let t=Array.from(this._texPairs.keys());for(let e of t)this.destroyTexturePair(e)}setActiveTexture(t){if(!this._texPairs.has(t))throw new Error("setActiveTexture: invalid id");this._tid=t;let e=this._texPairs.get(t);this.viewA=e.viewA,this.viewB=e.viewB,this.width=e.tileWidth,this.height=e.tileHeight,this.layers=e.layers,this.inputTextureView=e.isA?e.viewA:e.viewB,this.outputTextureView=e.isA?e.viewB:e.viewA}_buildPosBuffer(t,e,i){if(!(i instanceof Float32Array)||i.byteLength<=0)return this.nullPosBuffer;let r=Math.max(1,Math.floor(t)),a=Math.max(1,Math.floor(e)),l=r*a*4;if(i.length!==l)throw new Error(`_buildPosBuffer: customData length ${i.length} != expected ${l} (width=${r}, height=${a})`);let s=this.device?.limits?.maxBufferSize??2147483648,f=Math.floor(s*.98);if(i.byteLength>f)throw new Error(`_buildPosBuffer: ${i.byteLength} bytes exceeds maxBufferSize ${s} (w=${r}, h=${a})`);let p=this.device.createBuffer({size:i.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return this._writeBufferChunked(p,0,i.buffer,i.byteOffset,i.byteLength,this.maxBufferChunkBytes),p}_writeFrameUniform(t,e){let i=new ArrayBuffer(64),r=new DataView(i);r.setUint32(0,e.fullWidth>>>0,!0),r.setUint32(4,e.fullHeight>>>0,!0),r.setUint32(8,e.tileWidth>>>0,!0),r.setUint32(12,e.tileHeight>>>0,!0),r.setInt32(16,e.originX|0,!0),r.setInt32(20,e.originY|0,!0),r.setInt32(24,e.originZ|0,!0),r.setUint32(28,e.fullDepth>>>0,!0),r.setUint32(32,e.tileDepth>>>0,!0),r.setInt32(36,e.layerIndex|0,!0),r.setUint32(40,e.layers>>>0,!0),r.setUint32(44,0,!0),r.setFloat32(48,e.originXf??0,!0),r.setFloat32(52,e.originYf??0,!0),r.setFloat32(56,0,!0),r.setFloat32(60,0,!0),this.queue.writeBuffer(t,0,i)}_create2DTileBindGroups(t,e={}){let i=this._texPairs.get(t);if(!i)throw new Error("_create2DTileBindGroups: invalid tid");let a=((e.useCustomPos??0)|0)!==0&&e.customData instanceof Float32Array?e.customData:null,o=!!a,l=Array.isArray(i.tiles)&&i.tiles.some(f=>f&&f.posIsCustom);if(!o&&l&&(i.bindGroupDirty=!0),Array.isArray(i.tiles)&&!i.bindGroupDirty&&!o)return;let s=[];for(let f=0;f<i.tilesY;f++)for(let p=0;p<i.tilesX;p++){let u=f*i.tilesX+p,m=p*i.tileWidth,h=f*i.tileHeight,c=i.tiles&&i.tiles[u]||null,d=this.nullPosBuffer,v=!1;if(o)d=this._buildPosBuffer(i.tileWidth,i.tileHeight,a),v=d!==this.nullPosBuffer;else if(c&&c.posBuf&&!c.posIsCustom)d=c.posBuf,v=!1;else if(d=this.nullPosBuffer,v=!1,c&&c.posBuf&&c.posIsCustom)try{c.posBuf.destroy()}catch{}let b;c&&c.frames&&c.frames[0]?b=c.frames[0]:b=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let y=Number.isFinite(e.frameFullWidth)?e.frameFullWidth>>>0:i.fullWidth,z=Number.isFinite(e.frameFullHeight)?e.frameFullHeight>>>0:i.fullHeight,M=e.squareWorld||String(e.worldMode||"").toLowerCase()==="crop";if(e.squareWorld){let C=Math.max(y,z,i.fullWidth,i.fullHeight)>>>0;y=C,z=C}let D,w;if(M)D=m,w=h;else{let C=y/i.fullWidth,N=z/i.fullHeight;D=m*C,w=h*N}this._writeFrameUniform(b,{fullWidth:y,fullHeight:z,tileWidth:i.tileWidth,tileHeight:i.tileHeight,originX:m,originY:h,originZ:0,fullDepth:1,tileDepth:1,layerIndex:u,layers:i.layers,originXf:D,originYf:w});let S=c?.bgs?.[0]?.bgA??null,q=c?.bgs?.[0]?.bgB??null;(!S||!q||i.bindGroupDirty)&&(S=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:i.viewA},{binding:4,resource:i.viewB},{binding:5,resource:{buffer:d}},{binding:6,resource:{buffer:b}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]}),q=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:i.viewB},{binding:4,resource:i.viewA},{binding:5,resource:{buffer:d}},{binding:6,resource:{buffer:b}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]})),s.push({layerIndex:u,originX:m,originY:h,frames:[b],posBuf:d,posIsCustom:v,bgs:[{bgA:S,bgB:q}]})}i.tiles=s,i.bindGroupDirty=!1,this._tid===t&&(this._tiles=s)}async _runPipelines(t,e,i,r,a,o,l=1){let s=t,f=e,p=Array.isArray(o),u=0,m=this.device.createCommandEncoder(),h=m.beginComputePass();for(let c of this.noiseChoices){let d=typeof c=="number"?this.entryPoints[c]:c,v=this.pipelines.get(d);v||(v=this.device.createComputePipeline({layout:this.pipelineLayout,compute:{module:this.shaderModule,entryPoint:d}}),this.pipelines.set(d,v)),p&&this.setNoiseParams(o[u++]),h.setPipeline(v),h.setBindGroup(0,s),h.dispatchWorkgroups(Math.ceil(i/8),Math.ceil(r/8),l),[s,f]=[f,s]}return h.end(),this.queue.submit([m.finish()]),f}async computeToTexture(t,e,i={},r={}){let a=t|0,o=e|0;if(!(a>0&&o>0))throw new Error(`computeToTexture: invalid size ${t}x${e}`);if(this._tid!=null){let b=this._texPairs.get(this._tid);(!b||b.fullWidth!==a||b.fullHeight!==o)&&this.destroyTexturePair(this._tid)}if(this._tid==null){let b=this._create2DPair(a,o);this.setActiveTexture(b)}let l=this._texPairs.get(this._tid);if(!l)throw new Error("computeToTexture: failed to create 2D texture pair");i&&!Array.isArray(i)&&this.setNoiseParams(i);let s=r||{},p=((s.useCustomPos??0)|0)!==0&&s.customData instanceof Float32Array?s.customData:null,u=p?1:0;this.setOptions({...s,ioFlags:0,useCustomPos:u});let m={...s,useCustomPos:u,customData:p};(!l.tiles||l.bindGroupDirty||p)&&this._create2DTileBindGroups(this._tid,m),this._update2DTileFrames(this._tid,m);let h=l.isA,c=null,d=null;for(let b of l.tiles){let{bgA:y,bgB:z}=b.bgs[0],M=c?c===y?y:z:h?y:z,D=M===y?z:y;c=await this._runPipelines(M,D,l.tileWidth,l.tileHeight,1,i,1),d={bgA:y,bgB:z}}let v=c===d.bgB;return l.isA=v,this.isA=v,this.setActiveTexture(this._tid),this.getCurrentView()}getCurrentView(){let t=this._texPairs.get(this._tid);return t?t.isA?t.viewA:t.viewB:null}_compute3DTiling(t,e,i){let r=Math.min(t,se),a=Math.min(e,se),o=this.device?.limits?.maxBufferSize??256*1024*1024,l=r*a*Ie,s=Math.max(1,Math.floor(o*.8/Math.max(1,l))),f=Math.min(i,se,s),p=Math.ceil(t/r),u=Math.ceil(e/a),m=Math.ceil(i/f);return{tw:r,th:a,td:f,nx:p,ny:u,nz:m}}_create3DChunks(t,e,i){let r=this._compute3DTiling(t,e,i),a=[],o=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST;for(let l=0;l<r.nz;l++)for(let s=0;s<r.ny;s++)for(let f=0;f<r.nx;f++){let p=f*r.tw,u=s*r.th,m=l*r.td,h=this.device.createTexture({size:{width:r.tw,height:r.th,depthOrArrayLayers:r.td},dimension:"3d",format:"rgba16float",usage:o}),c=this.device.createTexture({size:{width:r.tw,height:r.th,depthOrArrayLayers:r.td},dimension:"3d",format:"rgba16float",usage:o}),d=h.createView({dimension:"3d"}),v=c.createView({dimension:"3d"});h.label=`3D texA ${r.tw}x${r.th}x${r.td} @ (${f},${s},${l})`,c.label=`3D texB ${r.tw}x${r.th}x${r.td} @ (${f},${s},${l})`,d.label=`3D:viewA[${f},${s},${l}]`,v.label=`3D:viewB[${f},${s},${l}]`,this._tag.set(d,`3D:A[${f},${s},${l}]`),this._tag.set(v,`3D:B[${f},${s},${l}]`),a.push({texA:h,texB:c,viewA:d,viewB:v,ox:p,oy:u,oz:m,w:r.tw,h:r.th,d:r.td,isA:!0,fb:null,posBuf:null,bgA:null,bgB:null})}return{chunks:a,tile:{w:r.tw,h:r.th,d:r.td},full:{w:t,h:e,d:i},grid:{nx:r.nx,ny:r.ny,nz:r.nz}}}_destroy3DSet(t){if(t)for(let e of t.chunks){try{e.texA.destroy()}catch{}try{e.texB.destroy()}catch{}if(e.viewA=null,e.viewB=null,e.bgA=null,e.bgB=null,e.fb){try{e.fb.destroy()}catch{}e.fb=null}if(e.posBuf&&e.posBuf!==this.nullPosBuffer){try{e.posBuf.destroy()}catch{}e.posBuf=null}}}destroyAllVolumes(){for(let[t,e]of this._volumeCache)this._destroy3DSet(e),this._volumeCache.delete(t)}get3DView(t){let e=this._volumeCache.get(String(t));if(!e)return null;let i=e.chunks.map(r=>r.isA?r.viewA:r.viewB);return i.length===1?i[0]:{views:i,meta:{full:e.full,tile:e.tile,grid:e.grid}}}destroyVolume(t){let e=String(t),i=this._volumeCache.get(e);i&&(this._destroy3DSet(i),this._volumeCache.delete(e))}_getOrCreate3DVolume(t,e,i,r=null,a=null){let o=r?String(r):`${t}x${e}x${i}`,l=this._volumeCache.get(o);if(l)return l;l=this._create3DChunks(t,e,i);for(let s of l.chunks){s.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let f=a&&Number.isFinite(a?.w)?a.w>>>0:l.full.w,p=a&&Number.isFinite(a?.h)?a.h>>>0:l.full.h,u=a&&Number.isFinite(a?.d)?a.d>>>0:l.full.d,m=f/l.full.w,h=p/l.full.h,c=s.ox*m,d=s.oy*h;this._writeFrameUniform(s.fb,{fullWidth:f,fullHeight:p,tileWidth:s.w,tileHeight:s.h,originX:s.ox,originY:s.oy,originZ:s.oz,fullDepth:u,tileDepth:s.d,layerIndex:0,layers:1,originXf:c,originYf:d});let v=this._buildPosBuffer(s.w,s.h,null);s.posBuf=v;try{s.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:v}},{binding:6,resource:{buffer:s.fb}},{binding:7,resource:s.viewA},{binding:8,resource:s.viewB}]}),s.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:s.posBuf}},{binding:6,resource:{buffer:s.fb}},{binding:7,resource:s.viewB},{binding:8,resource:s.viewA}]})}catch(b){throw new Error(`_getOrCreate3DVolume: createBindGroup failed: ${b?.message||b}`)}}return l._bindGroupsDirty=!1,this._volumeCache.set(o,l),l}_recreate3DBindGroups(t,e=null){if(!t||!Array.isArray(t.chunks))return;let i=e&&Number.isFinite(e.w)?e.w>>>0:t.full.w,r=e&&Number.isFinite(e.h)?e.h>>>0:t.full.h,a=e&&Number.isFinite(e.d)?e.d>>>0:t.full.d;for(let o of t.chunks){if(!o.fb){o.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let f=i/t.full.w,p=r/t.full.h,u=o.ox*f,m=o.oy*p;this._writeFrameUniform(o.fb,{fullWidth:i,fullHeight:r,tileWidth:o.w,tileHeight:o.h,originX:o.ox,originY:o.oy,originZ:o.oz,fullDepth:a,tileDepth:o.d,layerIndex:0,layers:1,originXf:u,originYf:m})}o.posBuf||(o.posBuf=this._buildPosBuffer(o.w,o.h,null));let l=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:o.posBuf}},{binding:6,resource:{buffer:o.fb}},{binding:7,resource:o.viewA},{binding:8,resource:o.viewB}],s=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:o.posBuf}},{binding:6,resource:{buffer:o.fb}},{binding:7,resource:o.viewB},{binding:8,resource:o.viewA}];try{o.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:l}),o.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:s})}catch(f){throw new Error(`_recreate3DBindGroups: failed to create bind groups: ${f?.message||f}`)}}t._bindGroupsDirty=!1}async computeToTexture3D(t,e,i,r={},a={}){let o=t|0,l=e|0,s=i|0;if(!(o>0&&l>0&&s>0))throw new Error(`computeToTexture3D: invalid size ${t}x${e}x${i}`);r&&!Array.isArray(r)&&this.setNoiseParams(r);let f=a||{};this.setOptions({...f,ioFlags:3,useCustomPos:f.useCustomPos??this.useCustomPos});let p=a&&(Number.isFinite(a.frameFullWidth)||Number.isFinite(a.frameFullHeight)||Number.isFinite(a.frameFullDepth))?{w:Number.isFinite(a.frameFullWidth)?a.frameFullWidth>>>0:o,h:Number.isFinite(a.frameFullHeight)?a.frameFullHeight>>>0:l,d:Number.isFinite(a.frameFullDepth)?a.frameFullDepth>>>0:s}:null,u=this._getOrCreate3DVolume(o,l,s,a.id,p);if(!u)throw new Error("computeToTexture3D: failed to create or retrieve volume");(u._bindGroupsDirty||!u.chunks[0].bgA||!u.chunks[0].bgB)&&this._recreate3DBindGroups(u,p),this._update3DChunkFrames(u,p,a);let m=null;for(let c of u.chunks){let d=c.isA?c.bgA:c.bgB,v=c.isA?c.bgB:c.bgA;if(!d||!v)throw new Error("computeToTexture3D: missing bind groups (volume not initialized correctly)");m=await this._runPipelines(d,v,c.w,c.h,c.d,r,c.d),c.isA=m===c.bgB}let h=u.chunks.map(c=>c.isA?c.viewA:c.viewB);return h.length===1?h[0]:{views:h,meta:{full:u.full,tile:u.tile,grid:u.grid}}}configureCanvas(t){let e=navigator.gpu.getPreferredCanvasFormat&&navigator.gpu.getPreferredCanvasFormat()||"bgra8unorm",i=t.getContext("webgpu");i.configure({device:this.device,format:e,alphaMode:"opaque",size:[t.width,t.height]}),this._ctxMap.set(t,{ctx:i,size:[t.width,t.height]})}initBlitRender(){this.sampler||(this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),this.bgl2D||(this.bgl2D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),this.pipeline2D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl2D]}),vertex:{module:this.device.createShaderModule({code:oe}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:oe}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}}),this.blit2DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})),this.bgl3D||(this.bgl3D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"3d"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),this.pipeline3D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl3D]}),vertex:{module:this.device.createShaderModule({code:ne}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:ne}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}}),this.blit3DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}))}_renderCommonCanvasSetup(t,e){let i="bgra8unorm",r=this._ctxMap.get(t);if(r){let l=t.width|0,s=t.height|0;(r.size[0]!==l||r.size[1]!==s)&&(r.size=[l,s],r.ctx.configure({device:this.device,format:i,alphaMode:"opaque",size:r.size}))}else{let l=t.getContext("webgpu"),s=[t.width|0,t.height|0];l.configure({device:this.device,format:i,alphaMode:"opaque",size:s}),r={ctx:l,size:s},this._ctxMap.set(t,r)}let a=this.device.createCommandEncoder(),o=a.beginRenderPass({colorAttachments:[{view:r.ctx.getCurrentTexture().createView(),loadOp:e?"clear":"load",clearValue:{r:0,g:0,b:0,a:1},storeOp:"store"}]});return{enc:a,pass:o,ctxEntry:r}}renderTextureToCanvas(t,e,i={}){let{layer:r=0,channel:a=0,preserveCanvasSize:o=!0,clear:l=!0}=i;if(this.initBlitRender(),!o)try{let m=t.texture;m&&typeof m.width=="number"&&typeof m.height=="number"&&(e.width=m.width,e.height=m.height)}catch{}let s=new Uint32Array([r>>>0,a>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,s.buffer,s.byteOffset,s.byteLength);let f=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:t},{binding:2,resource:{buffer:this.blit2DUbo}}]}),{enc:p,pass:u}=this._renderCommonCanvasSetup(e,l);u.setPipeline(this.pipeline2D),u.setBindGroup(0,f),u.draw(6,1,0,0),u.end(),this.queue.submit([p.finish()])}renderTexture3DSliceToCanvas(t,e,i={}){let{depth:r,slice:a=0,zNorm:o=null,channel:l=0,chunk:s=0,preserveCanvasSize:f=!0,clear:p=!0}=i;this.initBlitRender();let u,m;if(t&&t.views&&Array.isArray(t.views)?(u=t.views[Math.max(0,Math.min(s|0,t.views.length-1))],m=t.meta?.tile?.d??r):(u=t,m=r),!u||!m)throw new Error("renderTexture3DSliceToCanvas: need a 3D view and its depth");if(!f)try{let z=u.texture;z&&typeof z.width=="number"&&typeof z.height=="number"&&(e.width=z.width,e.height=z.height)}catch{}let h=o??(Math.min(Math.max(a,0),m-1)+.5)/m;h=Math.min(Math.max(h,0),1);let c=new ArrayBuffer(16),d=new DataView(c);d.setFloat32(0,h,!0),d.setUint32(4,l>>>0,!0),d.setUint32(8,0,!0),d.setUint32(12,0,!0),this.queue.writeBuffer(this.blit3DUbo,0,c);let v=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:u},{binding:2,resource:{buffer:this.blit3DUbo}}]}),{enc:b,pass:y}=this._renderCommonCanvasSetup(e,p);y.setPipeline(this.pipeline3D),y.setBindGroup(0,v),y.draw(6,1,0,0),y.end(),this.queue.submit([b.finish()])}setExportBackground(t="black"){this.exportBackground=t}_resolveExportBackground(t){let e=t===void 0?this.exportBackground:t;if(e==null)return{r:0,g:0,b:0,a:1,transparent:!1};if(typeof e=="string"){let r=e.trim().toLowerCase();if(r==="transparent")return{r:0,g:0,b:0,a:0,transparent:!0};if(r==="black")return{r:0,g:0,b:0,a:1,transparent:!1};if(r==="white")return{r:1,g:1,b:1,a:1,transparent:!1};if(r[0]==="#")return this._parseHexBackground(r)}let i=r=>{let a=Number(r);if(!Number.isFinite(a))return 0;let o=a>1?a/255:a;return Math.min(Math.max(o,0),1)};if(Array.isArray(e)){let r=i(e[0]),a=i(e[1]),o=i(e[2]),l=e.length>=4?i(e[3]):1;return{r,g:a,b:o,a:l,transparent:l<=0}}if(typeof e=="object"){let r=i(e.r),a=i(e.g),o=i(e.b),l=e.a===void 0?1:i(e.a);return{r,g:a,b:o,a:l,transparent:l<=0}}return{r:0,g:0,b:0,a:1,transparent:!1}}_parseHexBackground(t){let e=String(t).trim().replace(/^#/,""),i=m=>m+m,r=0,a=0,o=0,l=255;if(e.length===3||e.length===4)r=parseInt(i(e[0]),16),a=parseInt(i(e[1]),16),o=parseInt(i(e[2]),16),e.length===4&&(l=parseInt(i(e[3]),16));else if(e.length===6||e.length===8)r=parseInt(e.slice(0,2),16),a=parseInt(e.slice(2,4),16),o=parseInt(e.slice(4,6),16),e.length===8&&(l=parseInt(e.slice(6,8),16));else return{r:0,g:0,b:0,a:1,transparent:!1};let s=r/255,f=a/255,p=o/255,u=l/255;return{r:s,g:f,b:p,a:u,transparent:u<=0}}_applyExportBackground(t,e){if(!t||!e||e.transparent)return;let i=Math.round(e.r*255),r=Math.round(e.g*255),a=Math.round(e.b*255),o=Math.round((e.a??1)*255);if(o<=0)return;let l=t.length|0;if(o>=255){for(let s=0;s<l;s+=4){let f=t[s+3]|0;if(f===255)continue;if(f===0){t[s+0]=i,t[s+1]=r,t[s+2]=a,t[s+3]=255;continue}let p=255-f;t[s+0]=(t[s+0]*f+i*p)/255|0,t[s+1]=(t[s+1]*f+r*p)/255|0,t[s+2]=(t[s+2]*f+a*p)/255|0,t[s+3]=255}return}for(let s=0;s<l;s+=4){let f=t[s+0]|0,p=t[s+1]|0,u=t[s+2]|0,m=t[s+3]|0,h=m+o*(255-m)/255|0;if(h<=0){t[s+0]=0,t[s+1]=0,t[s+2]=0,t[s+3]=0;continue}let c=i*o|0,d=r*o|0,v=a*o|0,b=f*m|0,y=p*m|0,z=u*m|0,M=255-m|0,D=b+c*M/255|0,w=y+d*M/255|0,S=z+v*M/255|0;t[s+0]=Math.min(255,Math.max(0,D*255/h|0)),t[s+1]=Math.min(255,Math.max(0,w*255/h|0)),t[s+2]=Math.min(255,Math.max(0,S*255/h|0)),t[s+3]=Math.min(255,Math.max(0,h))}}_forceOpaqueAlpha(t){let e=t.length|0;for(let i=3;i<e;i+=4)t[i]=255}async export2DTextureToPNGBlob(t,e,i,r={}){if(!t)throw new Error("export2DTextureToPNGBlob: textureView is required");let a=Math.max(1,e|0),o=Math.max(1,i|0),l=r.layer??0,s=r.channel??0,f=this._resolveExportBackground(r.background);if(this.initBlitRender(),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch{}let u=this.device.createTexture({size:[a,o,1],format:"bgra8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),m=new Uint32Array([l>>>0,s>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,m.buffer,m.byteOffset,m.byteLength);let h=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:t},{binding:2,resource:{buffer:this.blit2DUbo}}]}),c=this.device.createCommandEncoder(),d=c.beginRenderPass({colorAttachments:[{view:u.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});if(d.setPipeline(this.pipeline2D),d.setBindGroup(0,h),d.draw(6,1,0,0),d.end(),this.queue.submit([c.finish()]),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch{}let v=await this._readBGRA8TextureToRGBA8Pixels(u,a,o,{maxBufferChunkBytes:r.maxBufferChunkBytes??this.maxBufferChunkBytes});u.destroy();let b=r.useAlphaForBackground===!0;f.transparent||b?this._applyExportBackground(v,f):this._forceOpaqueAlpha(v);let y=document.createElement("canvas");y.width=a,y.height=o;let z=y.getContext("2d");if(!z)throw new Error("export2DTextureToPNGBlob: unable to get 2D context");return z.putImageData(new ImageData(v,a,o),0,0),await new Promise((D,w)=>{y.toBlob(S=>{S?D(S):w(new Error("export2DTextureToPNGBlob: toBlob returned null"))},"image/png")})}async exportCurrent2DToPNGBlob(t,e,i={}){let r=this.getCurrentView();if(!r)throw new Error("exportCurrent2DToPNGBlob: no active 2D texture view");return this.export2DTextureToPNGBlob(r,t,e,i)}async export3DSliceToPNGBlob(t,e,i,r={}){if(!t)throw new Error("export3DSliceToPNGBlob: target is required");let a=Math.max(1,e|0),o=Math.max(1,i|0),{depth:l,slice:s=0,zNorm:f=null,channel:p=0,chunk:u=0}=r;if(!l||l<=0)throw new Error("export3DSliceToPNGBlob: depth must be provided and > 0");let m=this._resolveExportBackground(r.background);if(this.initBlitRender(),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch{}let h,c;if(t&&t.views&&Array.isArray(t.views)){let P=Math.max(0,Math.min(u|0,t.views.length-1));h=t.views[P],c=t.meta?.tile?.d??l}else h=t,c=l;if(!h||!c)throw new Error("export3DSliceToPNGBlob: need a 3D view and its depth");let d=f??(Math.min(Math.max(s,0),c-1)+.5)/c;d=Math.min(Math.max(d,0),1);let b=this.device.createTexture({size:[a,o,1],format:"bgra8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),y=new ArrayBuffer(16),z=new DataView(y);z.setFloat32(0,d,!0),z.setUint32(4,p>>>0,!0),z.setUint32(8,0,!0),z.setUint32(12,0,!0),this.queue.writeBuffer(this.blit3DUbo,0,y);let M=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:h},{binding:2,resource:{buffer:this.blit3DUbo}}]}),D=this.device.createCommandEncoder(),w=D.beginRenderPass({colorAttachments:[{view:b.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});w.setPipeline(this.pipeline3D),w.setBindGroup(0,M),w.draw(6,1,0,0),w.end();let S=4,q=256,C=a*S,N=Math.ceil(C/q)*q,E=N*o,B=this.device.createBuffer({size:E,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});D.copyTextureToBuffer({texture:b},{buffer:B,bytesPerRow:N,rowsPerImage:o},{width:a,height:o,depthOrArrayLayers:1}),this.queue.submit([D.finish()]),this.queue&&this.queue.onSubmittedWorkDone&&await this.queue.onSubmittedWorkDone(),await B.mapAsync(GPUMapMode.READ);let F=B.getMappedRange(),V=new Uint8Array(F),L=new Uint8ClampedArray(a*o*S),U=0;for(let P=0;P<o;P++){let I=P*N;for(let g=0;g<a;g++){let x=I+g*4;L[U++]=V[x+2],L[U++]=V[x+1],L[U++]=V[x+0],L[U++]=V[x+3]}}B.unmap(),B.destroy(),b.destroy(),this._applyExportBackground(L,m);let W=document.createElement("canvas");W.width=a,W.height=o;let A=W.getContext("2d");if(!A)throw new Error("export3DSliceToPNGBlob: unable to get 2D context");return A.putImageData(new ImageData(L,a,o),0,0),await new Promise((P,I)=>{W.toBlob(g=>{g?P(g):I(new Error("export3DSliceToPNGBlob: toBlob returned null"))},"image/png")})}async _render3DSliceToRGBA8Pixels(t,e,i,r,a=0,o=null){if(!t)throw new Error("_render3DSliceToRGBA8Pixels: view3D is required");let l=Math.max(1,e|0),s=Math.max(1,i|0);this.initBlitRender();let f=Math.min(Math.max(Number(r)||0,0),1),u=this.device.createTexture({size:[l,s,1],format:"bgra8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),m=new ArrayBuffer(16),h=new DataView(m);h.setFloat32(0,f,!0),h.setUint32(4,a>>>0,!0),h.setUint32(8,0,!0),h.setUint32(12,0,!0),this.queue.writeBuffer(this.blit3DUbo,0,m);let c=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:t},{binding:2,resource:{buffer:this.blit3DUbo}}]}),d=this.device.createCommandEncoder(),v=d.beginRenderPass({colorAttachments:[{view:u.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});v.setPipeline(this.pipeline3D),v.setBindGroup(0,c),v.draw(6,1,0,0),v.end();let b=4,y=256,z=l*b,M=Math.ceil(z/y)*y,D=M*s,w=this.device.createBuffer({size:D,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});d.copyTextureToBuffer({texture:u},{buffer:w,bytesPerRow:M,rowsPerImage:s},{width:l,height:s,depthOrArrayLayers:1}),this.queue.submit([d.finish()]),this.queue&&this.queue.onSubmittedWorkDone&&await this.queue.onSubmittedWorkDone(),await w.mapAsync(GPUMapMode.READ);let S=w.getMappedRange(),q=new Uint8Array(S),C=new Uint8ClampedArray(l*s*b),N=0;for(let E=0;E<s;E++){let B=E*M;for(let F=0;F<l;F++){let V=B+F*4;C[N++]=q[V+2],C[N++]=q[V+1],C[N++]=q[V+0],C[N++]=q[V+3]}}return w.unmap(),w.destroy(),u.destroy(),o&&this._applyExportBackground(C,o),C}async export3DTilesetToPNGBlob(t,e,i,r={}){if(!t)throw new Error("export3DTilesetToPNGBlob: target is required");let a=Math.max(1,e|0),o=Math.max(1,(i??e)|0),{depth:l,channel:s=0,chunk:f=0,tilesAcross:p=16,tilesDown:u=null,startSlice:m=0,sliceCount:h=null}=r,c=this._resolveExportBackground(r.background);if(this.initBlitRender(),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch{}let d,v;if(t&&t.views&&Array.isArray(t.views)){let B=Math.max(0,Math.min(f|0,t.views.length-1));d=t.views[B],v=t.meta?.tile?.d??l}else d=t,v=l;if(!d)throw new Error("export3DTilesetToPNGBlob: missing 3D view");if(!v||v<=0)throw new Error("export3DTilesetToPNGBlob: depth must be provided and > 0");let b=Math.max(1,p|0),y=u!=null?Math.max(1,u|0):Math.ceil(v/b),z=Math.min(Math.max(m|0,0),v-1),M=h!=null?Math.max(0,h|0):v-z,D=a*b,w=o*y,S=new Uint8ClampedArray(D*w*4),q=Math.min(v,z+M);for(let B=z;B<q;B++){let F=B-z,V=F%b,L=F/b|0;if(L>=y)break;let U=(B+.5)/v,W=await this._render3DSliceToRGBA8Pixels(d,a,o,U,s,c),A=V*a,T=L*o;for(let P=0;P<o;P++){let I=P*a*4,g=((T+P)*D+A)*4;S.set(W.subarray(I,I+a*4),g)}}let C=document.createElement("canvas");C.width=D,C.height=w;let N=C.getContext("2d");if(!N)throw new Error("export3DTilesetToPNGBlob: unable to get 2D context");return N.putImageData(new ImageData(S,D,w),0,0),await new Promise((B,F)=>{C.toBlob(V=>{V?B(V):F(new Error("export3DTilesetToPNGBlob: toBlob returned null"))},"image/png")})}_installAllocDebug(t=256*1024*1024){if(this._allocDebugInstalled)return;this._allocDebugInstalled=!0;let e=this.device,i=e.createBuffer.bind(e);e.createBuffer=a=>{let o=Number(a?.size??0);return Number.isFinite(o)&&o>=t&&console.warn("[alloc] createBuffer",{size:o,usage:a?.usage,mappedAtCreation:a?.mappedAtCreation},`
`,new Error().stack),i(a)};let r=e.createTexture.bind(e);e.createTexture=a=>{let o=r(a);try{let l=a?.format,s=l==="rgba16float"?8:l==="rgba8unorm"||l==="bgra8unorm"?4:0,f=a?.dimension||"2d",p=a?.size,u=0,m=0,h=1;if(Array.isArray(p)?(u=p[0]|0,m=p[1]|0,h=(p[2]??1)|0):p&&typeof p=="object"&&(u=p.width|0,m=p.height|0,h=(p.depthOrArrayLayers??1)|0),s&&u>0&&m>0&&h>0){let c=u*m*h*s;c>=t&&console.warn("[alloc] createTexture",{format:l,dimension:f,size:a?.size,approxBytes:c,usage:a?.usage},`
`,new Error().stack)}}catch{}return o}}},le=class{constructor(t=Date.now()){t<1e7&&(t*=1e7),this.seedN=t,this.seedK=t,this.perm=new Uint8Array(512),this.seed(t)}seed(t){let e=this.xorshift(t);for(let i=0;i<256;i++)this.perm[i]=i;for(let i=255;i>0;i--){let r=Math.floor(e()*(i+1));[this.perm[i],this.perm[r]]=[this.perm[r],this.perm[i]]}for(let i=0;i<256;i++)this.perm[i+256]=this.perm[i]}setSeed(t){this.seedN=t,this.seed(t),this.resetSeed()}random(t,e,i){let r;return typeof i=="number"?r=this.perm[(t&255)+this.perm[(e&255)+this.perm[i&255]]]&255:r=this.perm[(t&255)+this.perm[e&255]]&255,this.perm[r]/255*2-1}seededRandom(){this.seedK+=Math.E;let t=1e9*Math.sin(this.seedK);return t-Math.floor(t)}resetSeed(){this.seedK=this.seedN}xorshift(t){let e=t;return function(){return e^=e<<13,e^=e>>17,e^=e<<5,(e<0?1+~e:e)/4294967295}}dot(t,e=0,i=0,r=0){return t[0]*e+t[1]*i+t[2]*r}};document.body.insertAdjacentHTML("afterbegin",ye);var Ve=6,Le={computeCellular:"CellularPattern",computeWorley:"WorleyPattern",computeAntiCellular:"AntiCellularPattern",computeAntiWorley:"AntiWorleyPattern",computeWhiteNoise:"White Noise",computeBlueNoise:"Blue Noise"},Ge={computeRidge:{clamp:{freq:[.25,8],gain:[.2,.8],octaves:[1,12]}},computeAntiRidge:{clamp:{freq:[.25,8],gain:[.2,.8],octaves:[1,12]}},computeRidgedMultifractal:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal2:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal3:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal4:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeFBM:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeFBM2:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeFBM3:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeVoronoiBM1:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeVoronoiBM2:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeVoronoiBM3:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeCellular:{clamp:{threshold:[0,1]}},computeWorley:{clamp:{threshold:[0,1]}},computeAntiCellular:{clamp:{threshold:[0,1]}},computeAntiWorley:{clamp:{threshold:[0,1]}},computeSimplexFBM:{force:{turbulence:1},clamp:{warpAmp:[.1,2],freq:[.25,6]}},computeCurl2D:{force:{turbulence:1},clamp:{warpAmp:[.1,2],freq:[.25,6]}},computeCurlFBM2D:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeDomainWarpFBM1:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeDomainWarpFBM2:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeGaborAnisotropic:{clamp:{gaborRadius:[.5,6]}},computeFoamNoise:{force:{turbulence:1},clamp:{gain:[.5,.95]}}},k=128,we="toroidalDemo",Q=new Map,G=[],J=Object.create(null);function H(n){let t=String(n||""),e=Le[t];if(e)return e;let i=t;return i.startsWith("compute")&&(i=i.slice(7)),i||t}function We(n,t){let e=Object.create(null),i=Array.isArray(n)?n:[],r=Math.max(0,t|0),a=Math.max(0,i.length-r);for(let o=0;o<a;o++)e[o]=H(i[o]);return e}function Ue(){return Object.keys(J).map(n=>Number(n)).filter(n=>Number.isInteger(n)&&n>=0).sort((n,t)=>n-t)}function Oe(){let n=[];for(let t=0;t<G.length;t++){let e=G[t];typeof e!="string"||!e||e!=="clearTexture"&&n.push(t)}return n}function Ye(n){let t=G[n];return t&&Ge[String(t)]||null}function Z(n,t,e,i){if(!Object.prototype.hasOwnProperty.call(n,t))return;let r=Number(n[t]);if(!Number.isFinite(r))return;let a=Number(e),o=Number(i);n[t]=Math.min(Math.max(r,a),o)}function Me(n,t){let e={...t},i=Ye(n);if(i&&i.clamp){let a=i.clamp;a.freq&&Z(e,"freq",a.freq[0],a.freq[1]),a.gain&&Z(e,"gain",a.gain[0],a.gain[1]),a.octaves&&Z(e,"octaves",a.octaves[0],a.octaves[1]),a.threshold&&Z(e,"threshold",a.threshold[0],a.threshold[1]),a.warpAmp&&Z(e,"warpAmp",a.warpAmp[0],a.warpAmp[1]),a.gaborRadius&&Z(e,"gaborRadius",a.gaborRadius[0],a.gaborRadius[1]),a.edgeK&&Z(e,"edgeK",a.edgeK[0],a.edgeK[1])}if(i&&i.force)for(let[a,o]of Object.entries(i.force))e[a]=o;let r=Q.get(n);if(r)for(let[a,o]of Object.entries(r))typeof o=="number"&&Number.isFinite(o)&&(e[a]=o);return e}function de(){let n=(a,o)=>{let l=document.getElementById(a);if(!l)return o;let s=Number(l.value);return Number.isFinite(s)?s:o},t=(a,o)=>{let l=n(a,o);return Number.isFinite(l)?Math.max(0,Math.floor(l)):o},e=Math.max(1,Math.floor(n("noise-seed",1234567890))),i=document.getElementById("noise-turbulence"),r=i&&i.checked?1:0;return{seed:e,zoom:n("noise-zoom",1),freq:n("noise-freq",1),octaves:Math.max(1,Math.floor(n("noise-octaves",8))),lacunarity:n("noise-lacunarity",2),gain:n("noise-gain",.5),xShift:n("noise-xShift",0),yShift:n("noise-yShift",0),zShift:n("noise-zShift",0),turbulence:r,seedAngle:n("noise-seedAngle",0),exp1:n("noise-exp1",1),exp2:n("noise-exp2",0),threshold:n("noise-threshold",.1),rippleFreq:n("noise-rippleFreq",10),time:n("noise-time",0),warpAmp:n("noise-warpAmp",.5),gaborRadius:n("noise-gaborRadius",4),terraceStep:n("noise-terraceStep",8),toroidal:0,voroMode:t("noise-voroMode",0),edgeK:n("noise-edgeK",0)}}function Xe(){let n=document.querySelectorAll('input[type="checkbox"][name="noise-type"]'),t=[];return n.forEach(e=>{if(e.checked){let i=Number(e.dataset.bit);Number.isInteger(i)&&t.push(i)}}),t}function j(){let n=document.getElementById("z-slice"),t=document.getElementById("z-slice-num"),e=0;return n?e=Number(n.value):t&&(e=Number(t.value)),Number.isFinite(e)||(e=0),e=Math.min(Math.max(Math.round(e),0),k-1),n&&String(n.value)!==String(e)&&(n.value=String(e)),t&&String(t.value)!==String(e)&&(t.value=String(e)),e}function ae(n,t=null,e=null,i="contain"){n.style.display="block",n.style.margin="0",n.style.padding="0",n.style.border="0",n.style.outline="0",n.style.background="transparent",n.style.width=t!=null?`${t}px`:"100%",n.style.height=e!=null?`${e}px`:"100%",n.style.objectFit=i,n.style.objectPosition="center",n.style.imageRendering="crisp-edges",n.style.imageRendering="pixelated"}function ge(n,t,e,i,r=null,a=null){let o=Math.max(1,e|0),l=Math.max(1,i|0);ae(t,r,a);let s=!1;return(t.width!==o||t.height!==l)&&(t.width=o,t.height=l,s=!0),n&&typeof n.configureCanvas=="function"&&s&&n.configureCanvas(t),s}function Ze(n){n.style.display="grid",n.style.width="100%",n.style.height="100%",n.style.aspectRatio="1 / 1",n.style.gridTemplateColumns="repeat(3, 1fr)",n.style.gridTemplateRows="repeat(3, 1fr)",n.style.gap="0",n.style.padding="0",n.style.margin="0",n.style.border="0",n.style.lineHeight="0",n.style.fontSize="0",n.style.alignItems="stretch",n.style.justifyItems="stretch",n.style.alignContent="stretch",n.style.justifyContent="stretch",n.style.overflow="hidden",n.style.background="#000"}function He(){let n=document.getElementById("noise-canvas"),t=document.getElementById("view-stack");if(!n&&t&&(n=document.createElement("canvas"),n.id="noise-canvas",n.width=800,n.height=800,t.appendChild(n)),!n)throw new Error("Missing main preview canvas (#noise-canvas)");ae(n,null,null,"contain");let e=document.getElementById("mosaic");if(!e)throw new Error("Missing #mosaic container");let i=9,r=Array.from(e.querySelectorAll("canvas"));if(r.length!==i){e.innerHTML="",r=[];for(let a=0;a<i;a++){let o=document.createElement("canvas");o.width=k,o.height=k,ae(o,null,null,"fill"),e.appendChild(o),r.push(o)}}else r.forEach(a=>ae(a,null,null,"fill"));return Ze(e),{mainCanvas:n,mosaicCanvases:r}}function Se(n){return n.length?n.map(e=>J[e]||String(e)).join(", "):J[0]||"Perlin"}function Be(n){let t=document.getElementById(n);if(!t)throw new Error(`Missing #${n}`);return t}function Ke(){let n=Be("noise-type-list");n.innerHTML="";let t=Ue();for(let e of t){let i=document.createElement("label"),r=document.createElement("input");r.type="checkbox",r.name="noise-type",r.dataset.bit=String(e),e===0&&(r.checked=!0),i.appendChild(r),i.appendChild(document.createTextNode(" "+(J[e]||String(e)))),n.appendChild(i)}}function $e(n){return(Array.isArray(n)?n:[]).filter(e=>typeof e=="string"&&/4D/.test(e)&&e!=="clearTexture").slice()}function je(n){let t=Be("toroidal-type-list");t.innerHTML="";let e=$e(n),i=new Set(["computePerlin4D","computeWorley4D"]),r=!1;for(let a of e){let o=document.createElement("label"),l=document.createElement("input");l.type="checkbox",l.name="toroidal-type",l.dataset.entry=a;let s=G.indexOf(a);Number.isInteger(s)&&s>=0&&(l.dataset.bit=String(s)),i.has(a)&&(l.checked=!0,r=!0),o.appendChild(l),o.appendChild(document.createTextNode(" "+H(a))),t.appendChild(o)}if(!r&&e.length){let a=t.querySelector('input[type="checkbox"][name="toroidal-type"]');a&&(a.checked=!0)}}function $(){let n=document.querySelectorAll('input[type="checkbox"][name="toroidal-type"]'),t=[];if(n.forEach(e=>{if(!e.checked)return;let i=String(e.dataset.entry||"");if(!i)return;let r=Number(e.dataset.bit);Number.isInteger(r)||(r=G.indexOf(i)),Number.isInteger(r)||(r=-1),t.push({bit:r,entry:i})}),!t.length){let e=["computePerlin4D","computeWorley4D"];for(let i of e){if(!G.includes(i))continue;let r=G.indexOf(i);t.push({bit:r,entry:i})}}return t}function ue(n){let t=document.getElementById("mosaic-caption");if(!t)return;let e=Array.isArray(n)?n:[],i=e.length?e.map(r=>H(r)).join(" + "):"None";t.textContent=`A single toroidal Z slice from a 4D volume. Modes: ${i}. Repeated in X and Y. Use the Z slice control to see different slices.`}function Qe(){let n=document.getElementById("override-mode");if(!n)return;n.innerHTML="";let t=Oe();for(let e of t){let i=G[e],r=document.createElement("option");r.value=String(e),r.textContent=`${e}: ${H(i)}`,n.appendChild(r)}t.length&&(n.value=String(t[0]))}function fe(n){let t=Q.get(n)||{},e=(r,a)=>{let o=document.getElementById(r);if(!o)return;let l=t[a];o.value=typeof l=="number"&&Number.isFinite(l)?String(l):""},i=(r,a)=>{let o=document.getElementById(r);if(!o)return;let l=t[a];o.value=typeof l=="number"&&Number.isFinite(l)?String(l):""};e("ov-zoom","zoom"),e("ov-freq","freq"),e("ov-lacunarity","lacunarity"),e("ov-gain","gain"),e("ov-octaves","octaves"),i("ov-turbulence","turbulence"),e("ov-seedAngle","seedAngle"),e("ov-exp1","exp1"),e("ov-exp2","exp2"),e("ov-rippleFreq","rippleFreq"),e("ov-time","time"),e("ov-warp","warpAmp"),e("ov-threshold","threshold"),i("ov-voroMode","voroMode"),e("ov-edgeK","edgeK"),e("ov-gabor","gaborRadius"),e("ov-terraceStep","terraceStep"),e("ov-xShift","xShift"),e("ov-yShift","yShift"),e("ov-zShift","zShift")}function pe(){let n=document.getElementById("override-mode");if(!n)return;let t=Number(n.value);if(!Number.isInteger(t))return;let e=C=>{let N=document.getElementById(C);if(!N)return null;let E=String(N.value).trim();if(!E)return null;let B=Number(E);return Number.isFinite(B)?B:null},i=C=>{let N=document.getElementById(C);if(!N)return null;let E=String(N.value).trim();if(!E)return null;let B=Number(E);return Number.isFinite(B)?B:null},r={},a=e("ov-zoom"),o=e("ov-freq"),l=e("ov-lacunarity"),s=e("ov-gain"),f=e("ov-octaves"),p=i("ov-turbulence"),u=e("ov-seedAngle"),m=e("ov-exp1"),h=e("ov-exp2"),c=e("ov-rippleFreq"),d=e("ov-time"),v=e("ov-warp"),b=e("ov-threshold"),y=i("ov-voroMode"),z=e("ov-edgeK"),M=e("ov-gabor"),D=e("ov-terraceStep"),w=e("ov-xShift"),S=e("ov-yShift"),q=e("ov-zShift");a!==null&&(r.zoom=a),o!==null&&(r.freq=o),l!==null&&(r.lacunarity=l),s!==null&&(r.gain=s),f!==null&&(r.octaves=f),p!==null&&(r.turbulence=Math.max(0,Math.floor(p))),u!==null&&(r.seedAngle=u),m!==null&&(r.exp1=m),h!==null&&(r.exp2=h),c!==null&&(r.rippleFreq=c),d!==null&&(r.time=d),v!==null&&(r.warpAmp=v),b!==null&&(r.threshold=b),y!==null&&(r.voroMode=Math.max(0,Math.floor(y))),z!==null&&(r.edgeK=z),M!==null&&(r.gaborRadius=M),D!==null&&(r.terraceStep=D),w!==null&&(r.xShift=w),S!==null&&(r.yShift=S),q!==null&&(r.zShift=q),Object.keys(r).length?Q.set(t,r):Q.delete(t)}function ce(n){return typeof n=="string"&&/4d/i.test(n)}function Je(n,t=800){let e=document.getElementById("res-width"),i=document.getElementById("res-height"),r=(u,m)=>{let h=Number(u);return Number.isFinite(h)?Math.max(1,Math.floor(h)):m|0},a=n?.device?.limits||{},o=a.maxTextureDimension2D??8192,l=a.maxStorageTextureDimension2D??o,s=Math.min(o,l)|0,f=r(e?.value,t),p=r(i?.value,t);return f=Math.min(f,s),p=Math.min(p,s),e&&String(e.value)!==String(f)&&(e.value=String(f)),i&&String(i.value)!==String(p)&&(i.value=String(p)),{w:f,h:p}}function et(n,t,e,i){let a=Math.min(e,2048),o=Math.min(i,2048);ge(n,t,a,o)}function ee(n){let t=document.getElementById("preview-meta");t&&(t.textContent=n)}function K(n){let t=document.getElementById("preview-stats");t&&(t.textContent=n)}function Pe(){let n=(t,e=0)=>{let i=document.getElementById(t);if(!i)return e;let r=Number(i.value);return Number.isFinite(r)?r:e};return{x:n("res-offsetX",0),y:n("res-offsetY",0),z:n("res-offsetZ",0)}}function he(n){if(!n)return"";let t=Number(n.x)||0,e=Number(n.y)||0,i=Number(n.z)||0,r=1e-9;if(Math.abs(t)<r&&Math.abs(e)<r&&Math.abs(i)<r)return"";let a=o=>Math.abs(o)>=1?o.toFixed(2):o.toFixed(6);return` \xB7 tile offset ${a(t)},${a(e)},${a(i)}`}function tt(n){if(!n)return;let t=n.resW|0,e=n.resH|0,i=Array.isArray(n.noiseBits)?n.noiseBits:[],a=i.some(s=>ce(G[s]))?" \xB7 toroidal(4D)":"",o=Math.max(t,e)|0,l=he(n.tileOffsets);ee(`Height field preview \xB7 ${t}\xD7${e} \xB7 world ${o}\xD7${o} \xB7 modes: ${Se(i)}${a}${l}`),typeof n.computeMs=="number"&&typeof n.blitMs=="number"?K(`GPU compute ${n.computeMs.toFixed(1)} ms \xB7 blit ${n.blitMs.toFixed(1)} ms`):K("")}async function _e(n,t,e={}){let i=e.updateUI!==!1,{w:r,h:a}=Je(n,800),o=Pe(),l=Math.max(r,a)|0;et(n,t,r,a);let s=de();n.buildPermTable(s.seed|0);let f=Xe(),p=f.length?f:[0],u={getGradient:0,outputChannel:1,baseRadius:0,heightScale:1,useCustomPos:0,squareWorld:!0,worldMode:"crop"},m={offsetX:Number(o.x)||0,offsetY:Number(o.y)||0,offsetZ:Number(o.z)||0},h=performance.now();await n.computeToTexture(r,a,s,{...u,...m,noiseChoices:["clearTexture"]});for(let M of p){let D=G[M],w=Me(M,s);w.toroidal=ce(D)?1:0,await n.computeToTexture(r,a,w,{...u,...m,noiseChoices:[M]})}let c=performance.now(),d=n.getCurrentView(),v=performance.now();d&&n.renderTextureToCanvas(d,t,{layer:0,channel:0,preserveCanvasSize:!0,clear:!0});let b=performance.now(),y=c-h,z=b-v;if(i){let D=p.some(S=>ce(G[S]))?" \xB7 toroidal(4D)":"",w=he(o);ee(`Height field preview \xB7 ${r}\xD7${a} \xB7 world ${l}\xD7${l} \xB7 modes: ${Se(p)}${D}${w}`),K(`GPU compute ${y.toFixed(1)} ms \xB7 blit ${z.toFixed(1)} ms`)}return{resW:r,resH:a,noiseBits:p,computeMs:y,blitMs:z,tileOffsets:o}}async function De(n,t,e,i={}){let r=i.draw!==!1,a=i.updateUI!==!1,o=de();n.buildPermTable(o.seed|0);let l=Pe(),s=k|0,f={...o,toroidal:1},p=$();ue(p.map(d=>d.entry));let u=performance.now(),m=await n.computeToTexture3D(k,k,k,f,{noiseChoices:["clearTexture"],outputChannel:1,id:we});for(let d of p){let v=d.bit,b=d.entry,y=Number.isInteger(v)&&v>=0?Me(v,f):{...f};y.toroidal=1,m=await n.computeToTexture3D(k,k,k,y,{noiseChoices:[b],outputChannel:1,id:we})}let h=performance.now();e.lastToroidalVolumeView=m,e.lastToroidalComputeMs=h-u;let c=0;if(r&&(c=me(n,m,t)),a){let d=p.length?p.map(z=>H(z.entry)).join(" + "):"None",v=he(l);ee(`Toroidal tiles \xB7 ${k}\xB3 \xB7 modes: ${d} \xB7 Z slice: ${j()}${v}`);let b=e.lastToroidalComputeMs.toFixed(1),y=c.toFixed(1);K(r?`GPU volume compute ${b} ms \xB7 slice blit ${y} ms`:`GPU volume compute ${b} ms`)}return{computeMs:e.lastToroidalComputeMs,sliceBlitMs:c}}function me(n,t,e,i={}){if(!t)return 0;let r=k,o=(j()+.5)/r,l=Array.isArray(e)?e:[],s=l.length||9,f=performance.now();for(let u=0;u<s;u++){let m=l[u];m&&(ge(n,m,k,k),n.renderTexture3DSliceToCanvas(t,m,{depth:r,zNorm:o,channel:0,chunk:0,preserveCanvasSize:!0,clear:!0}))}return performance.now()-f}function O(){let n=document.getElementById("view-tab-tileset");return n&&n.checked?"tileset":"main"}async function it(){let n=document.getElementById("preview-stats");if(!navigator.gpu){console.error("WebGPU not available in this browser."),n&&(n.textContent="WebGPU not available in this browser.");return}let t=await navigator.gpu.requestAdapter();if(!t){console.error("Failed to get GPU adapter."),n&&(n.textContent="Failed to get GPU adapter.");return}let e=await t.requestDevice({requiredLimits:{maxBufferSize:t.limits.maxBufferSize}}),i=new re(e,e.queue);G=Array.isArray(i.entryPoints)?i.entryPoints.slice():[],J=We(G,Ve),Ke(),je(G),Qe();let{mainCanvas:r,mosaicCanvases:a}=He();i.configureCanvas(r),a.forEach(g=>i.configureCanvas(g));let o=document.getElementById("override-mode");if(o){let g=Number(o.value);Number.isInteger(g)&&fe(g)}let l={lastToroidalVolumeView:null,lastToroidalComputeMs:0,lastMainInfo:null},s={main:!0,tileset:!0},f=!1,p=!1,u=()=>{p=!0,!f&&(f=!0,requestAnimationFrame(async()=>{p=!1;let g=O();try{if(g==="main")s.main?(s.main=!1,l.lastMainInfo=await _e(i,r,{updateUI:!0})):tt(l.lastMainInfo);else if(s.tileset||!l.lastToroidalVolumeView)s.tileset=!1,await De(i,a,l,{draw:!0,updateUI:!0});else{let x=me(i,l.lastToroidalVolumeView,a),_=$(),R=_.length?_.map(Y=>H(Y.entry)).join(" + "):"None";ee(`Toroidal tiles \xB7 ${k}\xB3 \xB7 modes: ${R} \xB7 Z slice: ${j()}`),K(`GPU volume compute ${l.lastToroidalComputeMs.toFixed(1)} ms \xB7 slice blit ${x.toFixed(1)} ms`)}}catch(x){console.error(x),n&&(n.textContent=String(x))}f=!1,p&&u()}))},m=(g=!0)=>{s.main=!0,g&&O()==="main"&&u()},h=(g=!0)=>{s.tileset=!0,g&&O()==="tileset"&&u()},c=()=>{s.main=!0,s.tileset=!0,u()};["ov-zoom","ov-freq","ov-lacunarity","ov-gain","ov-octaves","ov-turbulence","ov-seedAngle","ov-exp1","ov-exp2","ov-rippleFreq","ov-time","ov-warp","ov-threshold","ov-voroMode","ov-edgeK","ov-gabor","ov-terraceStep","ov-xShift","ov-yShift","ov-zShift"].forEach(g=>{let x=document.getElementById(g);x&&x.addEventListener("change",()=>{pe(),c()})}),o&&o.addEventListener("change",()=>{let g=Number(o.value);Number.isInteger(g)&&fe(g)});let v=document.getElementById("ov-clear");v&&v.addEventListener("click",()=>{let g=document.getElementById("override-mode");if(!g)return;let x=Number(g.value);Number.isInteger(x)&&(Q.delete(x),fe(x),c())});let b=document.getElementById("render-btn");b&&b.addEventListener("click",()=>{O()==="main"?m(!0):h(!0)});let y=document.getElementById("apply-res");y&&y.addEventListener("click",()=>{c()}),["res-offsetX","res-offsetY","res-offsetZ"].forEach(g=>{let x=document.getElementById(g);x&&(x.addEventListener("input",()=>{s.main=!0,s.tileset=!0,u()}),x.addEventListener("change",()=>{s.main=!0,s.tileset=!0,u()}))}),["noise-seed","noise-zoom","noise-freq","noise-octaves","noise-lacunarity","noise-gain","noise-xShift","noise-yShift","noise-zShift","noise-voroMode","noise-threshold","noise-edgeK","noise-seedAngle","noise-turbulence","noise-time","noise-warpAmp","noise-gaborRadius","noise-terraceStep","noise-exp1","noise-exp2","noise-rippleFreq"].forEach(g=>{let x=document.getElementById(g);x&&(x.addEventListener("input",()=>{s.main=!0,s.tileset=!0,u()}),x.addEventListener("change",()=>{s.main=!0,s.tileset=!0,u()}))});let M=document.getElementById("noise-type-list");M&&M.addEventListener("change",g=>{let x=g.target;!x||x.name!=="noise-type"||m(!0)});let D=document.getElementById("toroidal-type-list");D&&D.addEventListener("change",g=>{let x=g.target;!x||x.name!=="toroidal-type"||(ue($().map(_=>_.entry)),h(!0))});let w=document.getElementById("z-slice"),S=document.getElementById("z-slice-num"),q=()=>{if(O()!=="tileset"||!l.lastToroidalVolumeView)return;let g=me(i,l.lastToroidalVolumeView,a);ee(`Toroidal tiles \xB7 ${k}\xB3 \xB7 Z slice: ${j()}`),K(`GPU volume compute ${l.lastToroidalComputeMs.toFixed(1)} ms \xB7 slice blit ${g.toFixed(1)} ms`)},C=(g,x=!0)=>{let _=Number(g);Number.isFinite(_)||(_=0),_=Math.round(_);let R=k|0;_=(_%R+R)%R,w&&String(w.value)!==String(_)&&(w.value=String(_)),S&&String(S.value)!==String(_)&&(S.value=String(_)),x&&q()};w&&(w.addEventListener("input",()=>{C(Number(w.value),!0)}),w.addEventListener("keydown",g=>{if(g.key!=="ArrowLeft"&&g.key!=="ArrowRight")return;g.preventDefault();let x=Number(w.step),_=Number.isFinite(x)&&x>0?Math.round(x):1,R=Number(w.value),Y=Number.isFinite(R)?Math.round(R):0,X=g.key==="ArrowLeft"?Y-_:Y+_;C(X,!0)})),S&&(S.addEventListener("change",()=>{C(Number(S.value),!0)}),S.addEventListener("keydown",g=>{if(g.key!=="ArrowDown"&&g.key!=="ArrowUp")return;g.preventDefault();let x=Number(S.value),_=Number.isFinite(x)?Math.round(x):0,R=g.key==="ArrowDown"?_-1:_+1;C(R,!0)}));let N=document.getElementById("view-tab-preview"),E=document.getElementById("view-tab-tileset");N&&N.addEventListener("change",()=>{u()}),E&&E.addEventListener("change",()=>{u()});function B(g,x){let _=URL.createObjectURL(g),R=document.createElement("a");R.href=_,R.download=x,document.body.appendChild(R),R.click(),R.remove(),URL.revokeObjectURL(_)}function F(g){return String(g||"").trim().replace(/\s+/g,"_").replace(/[^a-zA-Z0-9._-]+/g,"").slice(0,120)}function V(){let g=document.querySelector('input[type="radio"][name="export-bg"]:checked'),x=String(g?.value||"transparent");return x==="black"||x==="white"||x==="transparent"?x:"transparent"}function L(g){let x=V();return g&&typeof g.setExportBackground=="function"&&g.setExportBackground(x),x}function U(g){L(g),document.querySelectorAll('input[type="radio"][name="export-bg"]').forEach(_=>{_.addEventListener("change",()=>{L(g)})})}async function W(){pe(),await De(i,a,l,{draw:O()==="tileset",updateUI:O()==="tileset"})}let A=document.getElementById("download-main");A&&A.addEventListener("click",async()=>{try{pe();let g=L(i),x=Number(document.getElementById("res-width")?.value)||800,_=Number(document.getElementById("res-height")?.value)||800;ge(i,r,x,_),await _e(i,r,{updateUI:O()==="main"});let R=await i.exportCurrent2DToPNGBlob(x,_,{layer:0,channel:0,background:g});B(R,"noise-main.png")}catch(g){console.error("download-main failed:",g),n&&(n.textContent="Export main PNG failed: "+g)}});let T=document.getElementById("download-tile");T&&T.addEventListener("click",async()=>{try{let g=L(i);if(await W(),!l.lastToroidalVolumeView){console.warn("No toroidal volume available for export");return}let x=k,_=k,R=k,X=(j()+.5)/R,te=await i.export3DSliceToPNGBlob(l.lastToroidalVolumeView,x,_,{depth:R,zNorm:X,channel:0,chunk:0,background:g});B(te,"noise-tile.png")}catch(g){console.error("download-tile failed:",g),n&&(n.textContent="Export tile PNG failed: "+g)}});async function P(g,x){if(!x)return;let _=L(g);if(await W(),!x.lastToroidalVolumeView){console.warn("No toroidal volume available for tileset export");return}let R=de(),Y=$().map(qe=>qe.entry),X=16,te=k,ve=k,ie=k,xe=Math.ceil(ie/X),Ce=await g.export3DTilesetToPNGBlob(x.lastToroidalVolumeView,te,ve,{depth:ie,channel:0,chunk:0,tilesAcross:X,tilesDown:xe,startSlice:0,sliceCount:ie,background:_}),Ae=F(Y.map(H).join("+"))||"tileset",Te=F(R.seed),Ne=`noise-tileset_${Ae}_seed${Te}_${te}x${ve}_z${ie}_${X}x${xe}.png`;B(Ce,Ne)}let I=document.getElementById("download-tileset");I&&I.addEventListener("click",async()=>{try{await P(i,l)}catch(g){console.error("download-tileset failed:",g),n&&(n.textContent="Export tileset failed: "+g)}}),U(i),ue($().map(g=>g.entry)),u()}document.addEventListener("DOMContentLoaded",()=>{it().catch(n=>console.error(n))});})();
