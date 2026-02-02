(()=>{var ne=`<!-- tools/noise/noiseComponent.html -->\r
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
    /* view stack uses a square canvas wrapper with min size */\r
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
    #noise-canvas {\r
      display: block;\r
      width: 100%;\r
      height: 100%;\r
    }\r
\r
    /* Mosaic panel */\r
    #mosaic-box {\r
      margin: 0 var(--gap) var(--gap) var(--gap);\r
      padding: 10px;\r
\r
      background: radial-gradient(\r
        circle at top,\r
        #161616 0,\r
        #050505 40%,\r
        #000 100%\r
      );\r
      border: 1px solid #252525;\r
      border-radius: var(--radius);\r
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);\r
    }\r
\r
    #mosaic-box h2 {\r
      margin: 0;\r
      font-size: 0.95rem;\r
      padding: 2px 0 0 0;\r
      letter-spacing: 0.05em;\r
      text-transform: uppercase;\r
      color: #f0f0f0;\r
    }\r
\r
    #mosaic-box .mosaic-caption {\r
      margin: 6px 0 10px 0;\r
      font-size: 11px;\r
      color: #aaaaaa;\r
      line-height: 1.35;\r
    }\r
\r
    /* contiguous 3x3 tile canvases */\r
    #mosaic {\r
      width: 100%;\r
      display: grid;\r
      grid-template-columns: repeat(3, 1fr);\r
      grid-template-rows: repeat(3, 1fr);\r
      gap: 0;\r
      padding: 0;\r
      margin: 0;\r
      line-height: 0;\r
      font-size: 0;\r
\r
      border-radius: 8px;\r
      overflow: hidden;\r
      border: 1px solid #181818;\r
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
    /* Param groups */\r
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
      padding: 10px 9px 10px 9px;\r
      margin: 0 0 10px 0;\r
    }\r
\r
    aside#sidebar .param-group:hover {\r
      border-color: var(--accent);\r
      box-shadow:\r
        0 0 0 1px var(--accent-soft),\r
        0 6px 18px rgba(0, 0, 0, 0.7);\r
    }\r
\r
    aside#sidebar .param-group h2 {\r
      margin: 0 0 7px 0;\r
      font-size: 0.75rem;\r
      letter-spacing: 0.12em;\r
      text-transform: uppercase;\r
      color: #e0e0e0;\r
      border-bottom: 1px solid #262626;\r
      padding-bottom: 5px;\r
    }\r
\r
    .noise-modes-row {\r
      display: flex;\r
      align-items: flex-start;\r
      gap: 8px;\r
      margin-bottom: 4px;\r
    }\r
\r
    aside#sidebar .param-group > label:not(.grow) {\r
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
    aside#sidebar details {\r
      width: 100%;\r
    }\r
\r
    aside#sidebar details summary {\r
      cursor: pointer;\r
      font-weight: 600;\r
      list-style: none;\r
      padding: 4px 0;\r
      font-size: 0.86rem;\r
      color: #e4e4e4;\r
    }\r
\r
    aside#sidebar details > div {\r
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
    aside#sidebar details label {\r
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
      <a href="#toroidal-section" class="nav-pill">Z slice</a>\r
    </nav>\r
\r
    <div id="res-section" class="param-group">\r
      <h2>Resolution</h2>\r
      <label>\r
        Canvas width:\r
        <input type="number" id="res-width" value="800" min="1" />\r
      </label>\r
      <label>\r
        Canvas height:\r
        <input type="number" id="res-height" value="800" min="1" />\r
      </label>\r
      <button id="apply-res" type="button">Apply resolution</button>\r
    </div>\r
\r
    <div id="noise-params" class="param-group">\r
      <h2>Noise settings</h2>\r
\r
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
      <label>\r
        X shift:\r
        <input type="number" step="0.01" id="noise-xShift" value="0" />\r
      </label>\r
      <label>\r
        Y shift:\r
        <input type="number" step="0.01" id="noise-yShift" value="0" />\r
      </label>\r
      <label>\r
        Z shift:\r
        <input type="number" step="0.01" id="noise-zShift" value="0" />\r
      </label>\r
    </div>\r
\r
    <div id="voro-params" class="param-group">\r
      <h2>Voronoi</h2>\r
\r
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
\r
    <div id="adv-params" class="param-group">\r
      <h2>Advanced params</h2>\r
\r
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
\r
    <button id="render-btn" type="button">Render</button>\r
    <button id="download-main" type="button">Save image</button>\r
    <button id="download-tile" type="button">Save tile</button>\r
    <button id="download-tileset" type="button">Save tileset</button>\r
\r
    <div id="overrides-group" class="param-group">\r
      <h2>Per entry overrides</h2>\r
\r
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
\r
    <hr />\r
\r
    <div id="toroidal-section" class="param-group">\r
      <h2>Toroidal slice</h2>\r
\r
      <label class="grow">\r
        Volume 4D modes (additive):\r
        <details class="grow">\r
          <summary>Select 4D types \u25BE</summary>\r
          <div id="toroidal-type-list"></div>\r
        </details>\r
      </label>\r
\r
      <label>\r
        Z slice (0 to 127):\r
        <input type="range" id="z-slice" min="0" max="127" value="64" />\r
      </label>\r
      <label>\r
        Slice index:\r
        <input type="number" id="z-slice-num" min="0" max="127" value="64" />\r
      </label>\r
    </div>\r
  </aside>\r
\r
  <main id="main">\r
    <div id="view-stack" class="content">\r
      <div class="preview-header">\r
        <div id="preview-meta">Height field preview</div>\r
        <div id="preview-stats"></div>\r
      </div>\r
\r
      <div class="squareWrap">\r
        <canvas id="noise-canvas"></canvas>\r
      </div>\r
    </div>\r
\r
    <div id="mosaic-box" class="content">\r
      <h2>3D toroidal volume tiles (3\xD73)</h2>\r
      <p id="mosaic-caption" class="mosaic-caption"></p>\r
      <div id="mosaic"></div>\r
    </div>\r
  </main>\r
</div>\r
`;var le=`const PI : f32 = 3.141592653589793;\r
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
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Gabor sparse-convolution  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn gaborOctave3D(p: vec3<f32>, radius: f32) -> f32 {\r
    // 3 taps in a tiny kernel to keep it cheap\r
    let R = max(0.001, radius);\r
    var sum : f32 = 0.0;\r
    for (var i = -1; i <= 1; i = i + 1) {\r
        for (var j = -1; j <= 1; j = j + 1) {\r
            let xi = vec3<f32>(f32(i), f32(j), 0.0);\r
            let w  = exp(-dot(xi, xi) / (R * R));\r
            let n  = simplex3D(p + xi);  // using simplex as the carrier\r
            sum += w * n;\r
        }\r
    }\r
    return sum * 0.75; // keep in ~[-1,1]\r
}\r
\r
/* Multi-octave Gabor with the same rotate/shift cadence as Perlin */\r
fn gaborNoise3D(p: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = p.x / params.zoom * params.freq + params.xShift;\r
    var y = p.y / params.zoom * params.freq + params.yShift;\r
    var z = p.z / params.zoom * params.freq + params.zShift;\r
\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
    var angle   : f32 = params.seedAngle;\r
\r
    // tie kernel radius to frequency so bandwidth tracks lacunarity\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let radius = max(0.001, params.gaborRadius / freqLoc);\r
        var n = gaborOctave3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc), radius);\r
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
    if (params.turbulence == 1u) { sum = sum - 1.0; }\r
    return sum;\r
}\r
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
`;var Q=`// Fullscreen quad (module-scope constant)\r
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
`;var J=`const kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r
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
`;var se=4096,ee=2048,Be=8,j=class{constructor(i,e){this.device=i,this.queue=e,this.entryPoints=["computePerlin","computeBillow","computeAntiBillow","computeRidge","computeAntiRidge","computeRidgedMultifractal","computeRidgedMultifractal2","computeRidgedMultifractal3","computeRidgedMultifractal4","computeAntiRidgedMultifractal","computeAntiRidgedMultifractal2","computeAntiRidgedMultifractal3","computeAntiRidgedMultifractal4","computeFBM","computeFBM2","computeFBM3","computeCellularBM1","computeCellularBM2","computeCellularBM3","computeVoronoiBM1","computeVoronoiBM2","computeVoronoiBM3","computeCellular","computeWorley","computeAntiCellular","computeAntiWorley","computeLanczosBillow","computeLanczosAntiBillow","computeVoronoiTileNoise","computeVoronoiCircleNoise","computeVoronoiCircle2","computeVoronoiFlatShade","computeVoronoiRipple3D","computeVoronoiRipple3D2","computeVoronoiCircularRipple","computeFVoronoiRipple3D","computeFVoronoiCircularRipple","computeRippleNoise","computeFractalRipples","computeHexWorms","computePerlinWorms","computeWhiteNoise","computeBlueNoise","computeSimplex","computeSimplexFBM","computeCurl2D","computeCurlFBM2D","computeDomainWarpFBM1","computeDomainWarpFBM2","computeGaborAnisotropic","computeTerraceNoise","computeFoamNoise","computeTurbulence","computePerlin4D","computeWorley4D","computeAntiWorley4D","computeCellular4D","computeAntiCellular4D","computeBillow4D","computeAntiBillow4D","computeLanczosBillow4D","computeLanczosAntiBillow4D","computeFBM4D","computeVoronoi4D","computeVoronoiBM1_4D","computeVoronoiBM2_4D","computeVoronoiBM3_4D","computeVoronoiBM1_4D_vec","computeVoronoiBM2_4D_vec","computeVoronoiBM3_4D_vec","computeWorleyBM1_4D","computeWorleyBM2_4D","computeWorleyBM3_4D","computeWorleyBM1_4D_vec","computeWorleyBM2_4D_vec","computeWorleyBM3_4D_vec","computeCellularBM1_4D","computeCellularBM2_4D","computeCellularBM3_4D","computeCellularBM1_4D_vec","computeCellularBM2_4D_vec","computeCellularBM3_4D_vec","computeTerraceNoise4D","computeFoamNoise4D","computeTurbulence4D","computeGauss5x5","computeNormal","computeNormal8","computeSphereNormal","computeNormalVolume","clearTexture"],this.shaderModule=i.createShaderModule({code:le}),this.bindGroupLayout=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"2d-array"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:7,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"3d"}},{binding:8,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"3d"}}]}),this.pipelineLayout=i.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),this.pipelines=new Map,this._texPairs=new Map,this._tid=null,this._tag=new WeakMap,this._volumeCache=new Map,this.viewA=null,this.viewB=null,this.width=0,this.height=0,this.layers=1,this.isA=!0,this._initBuffers(),this._ensureDummies(),this._ctxMap=new WeakMap}_initBuffers(){this.optionsBuffer?.destroy(),this.paramsBuffer?.destroy(),this.permBuffer?.destroy(),this.nullPosBuffer?.destroy(),this.optionsBuffer=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.paramsBuffer=this.device.createBuffer({size:88,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.permBuffer=this.device.createBuffer({size:512*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.nullPosBuffer=this.device.createBuffer({size:64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.queue.writeBuffer(this.optionsBuffer,0,new ArrayBuffer(32)),this.queue.writeBuffer(this.paramsBuffer,0,new ArrayBuffer(88)),this.queue.writeBuffer(this.permBuffer,0,new Uint32Array(512))}_ensureDummies(){this._dummy2D_sampleTex||(this._dummy2D_sampleTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this._dummy2D_sampleView=this._dummy2D_sampleTex.createView({dimension:"2d-array",arrayLayerCount:1})),this._dummy2D_writeTex||(this._dummy2D_writeTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST}),this._dummy2D_writeView=this._dummy2D_writeTex.createView({dimension:"2d-array",arrayLayerCount:1})),this._dummy3D_sampleTex||(this._dummy3D_sampleTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this._dummy3D_sampleView=this._dummy3D_sampleTex.createView({dimension:"3d"})),this._dummy3D_writeTex||(this._dummy3D_writeTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST}),this._dummy3D_writeView=this._dummy3D_writeTex.createView({dimension:"3d"}))}resize(i){this.maxConfigs=i,this._initBuffers()}setPermTable(i){this.queue.writeBuffer(this.permBuffer,0,i)}setPosBuffer(i){this.posBuffer=i}setInputTextureView(i){try{if(((i?.texture?.usage??0)&GPUTextureUsage.TEXTURE_BINDING)===0){console.warn("setInputTextureView: provided texture view not created with TEXTURE_BINDING; ignoring.");return}}catch{}if(this.inputTextureView=i,this._tid!==null){let e=this._texPairs.get(this._tid);e&&(e.bindGroupDirty=!0)}}setOutputTextureView(i){try{if(((i?.texture?.usage??0)&GPUTextureUsage.STORAGE_BINDING)===0){console.warn("setOutputTextureView: provided texture view not created with STORAGE_BINDING; ignoring.");return}}catch{}if(this.outputTextureView=i,this._tid!==null){let e=this._texPairs.get(this._tid);e&&(e.bindGroupDirty=!0)}}buildPermTable(i=Date.now()){let t=new ie(i).perm,r=new Uint32Array(512);for(let a=0;a<512;a++)r[a]=t[a];this.setPermTable(r)}setOptions(i={}){Array.isArray(i.noiseChoices)?this.noiseChoices=i.noiseChoices:this.noiseChoices||(this.noiseChoices=[0]);let{getGradient:e=0,outputChannel:t=1,baseRadius:r=0,heightScale:a=1,useCustomPos:n=0,ioFlags:l=0}=i;this.useCustomPos=n>>>0;let s=new ArrayBuffer(32),p=new DataView(s);p.setUint32(0,e,!0),p.setUint32(4,this.useCustomPos,!0),p.setUint32(8,t,!0),p.setUint32(12,l>>>0,!0),p.setFloat32(16,r,!0),p.setFloat32(20,a,!0),p.setFloat32(24,0,!0),p.setFloat32(28,0,!0),this.queue.writeBuffer(this.optionsBuffer,0,s);for(let c of this._texPairs.values())c.bindGroupDirty=!0}setNoiseParams(i={}){let{seed:e=Date.now()|0,zoom:t=1,freq:r=1,octaves:a=8,lacunarity:n=2,gain:l=.5,xShift:s=0,yShift:p=0,zShift:c=0,turbulence:u=0,seedAngle:m=0,exp1:x=1,exp2:d=0,threshold:g=.1,rippleFreq:v=10,time:_=0,warpAmp:D=.5,gaborRadius:P=4,terraceStep:B=8,toroidal:M=0,voroMode:q=0,edgeK:C=0}=i,R=Math.max(t,1e-6),A=Math.max(r,1e-6),N=(M?1:0)>>>0,S=new ArrayBuffer(88),y=new DataView(S),h=0;y.setUint32(h+0,e>>>0,!0),y.setFloat32(h+4,t,!0),y.setFloat32(h+8,r,!0),y.setUint32(h+12,a>>>0,!0),y.setFloat32(h+16,n,!0),y.setFloat32(h+20,l,!0),y.setFloat32(h+24,s,!0),y.setFloat32(h+28,p,!0),y.setFloat32(h+32,c,!0),y.setUint32(h+36,u?1:0,!0),y.setFloat32(h+40,m,!0),y.setFloat32(h+44,x,!0),y.setFloat32(h+48,d,!0),y.setFloat32(h+52,g,!0),y.setFloat32(h+56,v,!0),y.setFloat32(h+60,_,!0),y.setFloat32(h+64,D,!0),y.setFloat32(h+68,P,!0),y.setFloat32(h+72,B,!0),y.setUint32(h+76,N>>>0,!0),y.setUint32(h+80,q>>>0,!0),y.setFloat32(h+84,C,!0),this.queue.writeBuffer(this.paramsBuffer,0,S);for(let f of this._texPairs.values())f.bindGroupDirty=!0;for(let[f,z]of this._volumeCache)!z||!Array.isArray(z.chunks)||(z._bindGroupsDirty=!0)}_compute2DTiling(i,e){let t=Math.min(i,se),r=Math.min(e,se),a=Math.ceil(i/t),n=Math.ceil(e/r),l=a*n;return{tileW:t,tileH:r,tilesX:a,tilesY:n,layers:l}}_create2DPair(i,e){let t=this._compute2DTiling(i,e),r=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST,a=()=>this.device.createTexture({size:[t.tileW,t.tileH,t.layers],format:"rgba16float",usage:r}),n={dimension:"2d-array",arrayLayerCount:t.layers},l=a(),s=a(),p=l.createView(n),c=s.createView(n);l.label=`2D texA ${i}x${e}x${t.layers}`,s.label=`2D texB ${i}x${e}x${t.layers}`,p.label="2D:viewA",c.label="2D:viewB",this._tag.set(p,"2D:A"),this._tag.set(c,"2D:B");let u=this._texPairs.size;return this._texPairs.set(u,{texA:l,texB:s,viewA:p,viewB:c,fullWidth:i,fullHeight:e,tileWidth:t.tileW,tileHeight:t.tileH,tilesX:t.tilesX,tilesY:t.tilesY,layers:t.layers,isA:!0,tiles:null,bindGroupDirty:!0}),this._tid===null&&this.setActiveTexture(u),u}createShaderTextures(i,e){this._tid!==null&&this._texPairs.has(this._tid)&&this.destroyTexturePair(this._tid);let t=this._create2DPair(i,e);return this.setActiveTexture(t),t}destroyTexturePair(i){let e=this._texPairs.get(i);if(e){try{e.texA.destroy()}catch{}try{e.texB.destroy()}catch{}if(Array.isArray(e.tiles))for(let t of e.tiles){if(Array.isArray(t.frames))for(let r of t.frames)try{r.destroy()}catch{}if(t.posBuf&&t.posBuf!==this.nullPosBuffer)try{t.posBuf.destroy()}catch{}}this._texPairs.delete(i),this._tid===i&&(this._tid=null,this.inputTextureView=null,this.outputTextureView=null,this.viewA=null,this.viewB=null)}}destroyAllTexturePairs(){let i=Array.from(this._texPairs.keys());for(let e of i)this.destroyTexturePair(e)}setActiveTexture(i){if(!this._texPairs.has(i))throw new Error("setActiveTexture: invalid id");this._tid=i;let e=this._texPairs.get(i);this.viewA=e.viewA,this.viewB=e.viewB,this.width=e.tileWidth,this.height=e.tileHeight,this.layers=e.layers,this.inputTextureView=e.isA?e.viewA:e.viewB,this.outputTextureView=e.isA?e.viewB:e.viewA}_buildPosBuffer(i,e,t){if((this.useCustomPos|0)===0&&!t)return this.nullPosBuffer;let r=i*e,a=t instanceof Float32Array&&t.length===r*4?t:new Float32Array(r*4),n=this.device.createBuffer({size:a.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return this.queue.writeBuffer(n,0,a.buffer,a.byteOffset,a.byteLength),n}_writeFrameUniform(i,e){let t=new ArrayBuffer(64),r=new DataView(t);r.setUint32(0,e.fullWidth>>>0,!0),r.setUint32(4,e.fullHeight>>>0,!0),r.setUint32(8,e.tileWidth>>>0,!0),r.setUint32(12,e.tileHeight>>>0,!0),r.setInt32(16,e.originX|0,!0),r.setInt32(20,e.originY|0,!0),r.setInt32(24,e.originZ|0,!0),r.setUint32(28,e.fullDepth>>>0,!0),r.setUint32(32,e.tileDepth>>>0,!0),r.setInt32(36,e.layerIndex|0,!0),r.setUint32(40,e.layers>>>0,!0),r.setUint32(44,0,!0),r.setFloat32(48,e.originXf??0,!0),r.setFloat32(52,e.originYf??0,!0),r.setFloat32(56,0,!0),r.setFloat32(60,0,!0),this.queue.writeBuffer(i,0,t)}_create2DTileBindGroups(i,e={}){let t=this._texPairs.get(i);if(!t)throw new Error("_create2DTileBindGroups: invalid tid");if(Array.isArray(t.tiles)&&!t.bindGroupDirty&&!e.customData)return;let r=[];for(let a=0;a<t.tilesY;a++)for(let n=0;n<t.tilesX;n++){let l=a*t.tilesX+n,s=n*t.tileWidth,p=a*t.tileHeight,c=t.tiles&&t.tiles[l]||null,u;c&&c.posBuf&&!e.customData?u=c.posBuf:u=this._buildPosBuffer(t.tileWidth,t.tileHeight,e.customData);let m;c&&c.frames&&c.frames[0]?m=c.frames[0]:m=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let x=Number.isFinite(e.frameFullWidth)?e.frameFullWidth>>>0:t.fullWidth,d=Number.isFinite(e.frameFullHeight)?e.frameFullHeight>>>0:t.fullHeight,g=x/t.fullWidth,v=d/t.fullHeight,_=s*g,D=p*v;this._writeFrameUniform(m,{fullWidth:x,fullHeight:d,tileWidth:t.tileWidth,tileHeight:t.tileHeight,originX:s,originY:p,originZ:0,fullDepth:1,tileDepth:1,layerIndex:l,layers:t.layers,originXf:_,originYf:D});let P=c?.bgs?.[0]?.bgA??null,B=c?.bgs?.[0]?.bgB??null;if(!P||!B||t.bindGroupDirty)try{P=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:t.viewA},{binding:4,resource:t.viewB},{binding:5,resource:{buffer:u}},{binding:6,resource:{buffer:m}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]}),B=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:t.viewB},{binding:4,resource:t.viewA},{binding:5,resource:{buffer:u}},{binding:6,resource:{buffer:m}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]})}catch(M){throw new Error(`_create2DTileBindGroups: createBindGroup failed: ${M?.message||M}`)}r.push({layerIndex:l,originX:s,originY:p,frames:[m],posBuf:u,bgs:[{bgA:P,bgB:B}]})}t.tiles=r,t.bindGroupDirty=!1,this._tid===i&&(this._tiles=r)}async _runPipelines(i,e,t,r,a,n,l=1){let s=i,p=e,c=Array.isArray(n),u=0,m=this.device.createCommandEncoder(),x=m.beginComputePass();for(let d of this.noiseChoices){let g=typeof d=="number"?this.entryPoints[d]:d,v=this.pipelines.get(g);v||(v=this.device.createComputePipeline({layout:this.pipelineLayout,compute:{module:this.shaderModule,entryPoint:g}}),this.pipelines.set(g,v)),c&&this.setNoiseParams(n[u++]),x.setPipeline(v),x.setBindGroup(0,s),x.dispatchWorkgroups(Math.ceil(t/8),Math.ceil(r/8),l),[s,p]=[p,s]}return x.end(),this.queue.submit([m.finish()]),p}async computeToTexture(i,e,t={},r={}){let a=i|0,n=e|0;if(!(a>0&&n>0))throw new Error(`computeToTexture: invalid size ${i}x${e}`);this._tid==null&&this._create2DPair(a,n);let l=this._texPairs.get(this._tid);if(!l||l.fullWidth!==a||l.fullHeight!==n){let x=this._create2DPair(a,n);this.setActiveTexture(x),l=this._texPairs.get(x)}t&&!Array.isArray(t)&&this.setNoiseParams(t);let s=r||{};this.setOptions({...s,ioFlags:0,useCustomPos:s.useCustomPos??this.useCustomPos}),(!l.tiles||l.bindGroupDirty||s.customData)&&this._create2DTileBindGroups(this._tid,r);let p=l.isA,c=null,u=null;for(let x of l.tiles){let{bgs:d}=x,{bgA:g,bgB:v}=d[0],_=c?c===g?g:v:p?g:v,D=_===g?v:g;c=await this._runPipelines(_,D,l.tileWidth,l.tileHeight,1,t,1),u={bgA:g,bgB:v}}let m=c===u.bgB;return l.isA=m,this.isA=m,this.setActiveTexture(this._tid),this.getCurrentView()}getCurrentView(){let i=this._texPairs.get(this._tid);return i?i.isA?i.viewA:i.viewB:null}_compute3DTiling(i,e,t){let r=Math.min(i,ee),a=Math.min(e,ee),n=this.device?.limits?.maxBufferSize??256*1024*1024,l=r*a*Be,s=Math.max(1,Math.floor(n*.8/Math.max(1,l))),p=Math.min(t,ee,s),c=Math.ceil(i/r),u=Math.ceil(e/a),m=Math.ceil(t/p);return{tw:r,th:a,td:p,nx:c,ny:u,nz:m}}_create3DChunks(i,e,t){let r=this._compute3DTiling(i,e,t),a=[],n=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST;for(let l=0;l<r.nz;l++)for(let s=0;s<r.ny;s++)for(let p=0;p<r.nx;p++){let c=p*r.tw,u=s*r.th,m=l*r.td,x=this.device.createTexture({size:{width:r.tw,height:r.th,depthOrArrayLayers:r.td},dimension:"3d",format:"rgba16float",usage:n}),d=this.device.createTexture({size:{width:r.tw,height:r.th,depthOrArrayLayers:r.td},dimension:"3d",format:"rgba16float",usage:n}),g=x.createView({dimension:"3d"}),v=d.createView({dimension:"3d"});x.label=`3D texA ${r.tw}x${r.th}x${r.td} @ (${p},${s},${l})`,d.label=`3D texB ${r.tw}x${r.th}x${r.td} @ (${p},${s},${l})`,g.label=`3D:viewA[${p},${s},${l}]`,v.label=`3D:viewB[${p},${s},${l}]`,this._tag.set(g,`3D:A[${p},${s},${l}]`),this._tag.set(v,`3D:B[${p},${s},${l}]`),a.push({texA:x,texB:d,viewA:g,viewB:v,ox:c,oy:u,oz:m,w:r.tw,h:r.th,d:r.td,isA:!0,fb:null,posBuf:null,bgA:null,bgB:null})}return{chunks:a,tile:{w:r.tw,h:r.th,d:r.td},full:{w:i,h:e,d:t},grid:{nx:r.nx,ny:r.ny,nz:r.nz}}}_destroy3DSet(i){if(i)for(let e of i.chunks){try{e.texA.destroy()}catch{}try{e.texB.destroy()}catch{}if(e.viewA=null,e.viewB=null,e.bgA=null,e.bgB=null,e.fb){try{e.fb.destroy()}catch{}e.fb=null}if(e.posBuf&&e.posBuf!==this.nullPosBuffer){try{e.posBuf.destroy()}catch{}e.posBuf=null}}}destroyAllVolumes(){for(let[i,e]of this._volumeCache)this._destroy3DSet(e),this._volumeCache.delete(i)}get3DView(i){let e=this._volumeCache.get(String(i));if(!e)return null;let t=e.chunks.map(r=>r.isA?r.viewA:r.viewB);return t.length===1?t[0]:{views:t,meta:{full:e.full,tile:e.tile,grid:e.grid}}}destroyVolume(i){let e=String(i),t=this._volumeCache.get(e);t&&(this._destroy3DSet(t),this._volumeCache.delete(e))}_getOrCreate3DVolume(i,e,t,r=null,a=null){let n=r?String(r):`${i}x${e}x${t}`,l=this._volumeCache.get(n);if(l)return l;l=this._create3DChunks(i,e,t);for(let s of l.chunks){s.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let p=a&&Number.isFinite(a?.w)?a.w>>>0:l.full.w,c=a&&Number.isFinite(a?.h)?a.h>>>0:l.full.h,u=a&&Number.isFinite(a?.d)?a.d>>>0:l.full.d,m=p/l.full.w,x=c/l.full.h,d=s.ox*m,g=s.oy*x;this._writeFrameUniform(s.fb,{fullWidth:p,fullHeight:c,tileWidth:s.w,tileHeight:s.h,originX:s.ox,originY:s.oy,originZ:s.oz,fullDepth:u,tileDepth:s.d,layerIndex:0,layers:1,originXf:d,originYf:g});let v=this._buildPosBuffer(s.w,s.h,null);s.posBuf=v;try{s.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:v}},{binding:6,resource:{buffer:s.fb}},{binding:7,resource:s.viewA},{binding:8,resource:s.viewB}]}),s.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:s.posBuf}},{binding:6,resource:{buffer:s.fb}},{binding:7,resource:s.viewB},{binding:8,resource:s.viewA}]})}catch(_){throw new Error(`_getOrCreate3DVolume: createBindGroup failed: ${_?.message||_}`)}}return l._bindGroupsDirty=!1,this._volumeCache.set(n,l),l}_recreate3DBindGroups(i,e=null){if(!i||!Array.isArray(i.chunks))return;let t=e&&Number.isFinite(e.w)?e.w>>>0:i.full.w,r=e&&Number.isFinite(e.h)?e.h>>>0:i.full.h,a=e&&Number.isFinite(e.d)?e.d>>>0:i.full.d;for(let n of i.chunks){if(!n.fb){n.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let p=t/i.full.w,c=r/i.full.h,u=n.ox*p,m=n.oy*c;this._writeFrameUniform(n.fb,{fullWidth:t,fullHeight:r,tileWidth:n.w,tileHeight:n.h,originX:n.ox,originY:n.oy,originZ:n.oz,fullDepth:a,tileDepth:n.d,layerIndex:0,layers:1,originXf:u,originYf:m})}n.posBuf||(n.posBuf=this._buildPosBuffer(n.w,n.h,null));let l=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:n.posBuf}},{binding:6,resource:{buffer:n.fb}},{binding:7,resource:n.viewA},{binding:8,resource:n.viewB}],s=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:n.posBuf}},{binding:6,resource:{buffer:n.fb}},{binding:7,resource:n.viewB},{binding:8,resource:n.viewA}];try{n.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:l}),n.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:s})}catch(p){throw new Error(`_recreate3DBindGroups: failed to create bind groups: ${p?.message||p}`)}}i._bindGroupsDirty=!1}async computeToTexture3D(i,e,t,r={},a={}){let n=i|0,l=e|0,s=t|0;if(!(n>0&&l>0&&s>0))throw new Error(`computeToTexture3D: invalid size ${i}x${e}x${t}`);r&&!Array.isArray(r)&&this.setNoiseParams(r);let p=a||{};this.setOptions({...p,ioFlags:3,useCustomPos:p.useCustomPos??this.useCustomPos});let c=a&&(Number.isFinite(a.frameFullWidth)||Number.isFinite(a.frameFullHeight)||Number.isFinite(a.frameFullDepth))?{w:Number.isFinite(a.frameFullWidth)?a.frameFullWidth>>>0:n,h:Number.isFinite(a.frameFullHeight)?a.frameFullHeight>>>0:l,d:Number.isFinite(a.frameFullDepth)?a.frameFullDepth>>>0:s}:null,u=this._getOrCreate3DVolume(n,l,s,a.id,c);if(!u)throw new Error("computeToTexture3D: failed to create or retrieve volume");(u._bindGroupsDirty||!u.chunks[0].bgA||!u.chunks[0].bgB)&&this._recreate3DBindGroups(u,c);let m=null;for(let d of u.chunks){let g=d.isA?d.bgA:d.bgB,v=d.isA?d.bgB:d.bgA;if(!g||!v)throw new Error("computeToTexture3D: missing bind groups (volume not initialized correctly)");m=await this._runPipelines(g,v,d.w,d.h,d.d,r,d.d),d.isA=m===d.bgB}let x=u.chunks.map(d=>d.isA?d.viewA:d.viewB);return x.length===1?x[0]:{views:x,meta:{full:u.full,tile:u.tile,grid:u.grid}}}configureCanvas(i){let e=navigator.gpu.getPreferredCanvasFormat&&navigator.gpu.getPreferredCanvasFormat()||"bgra8unorm",t=i.getContext("webgpu");t.configure({device:this.device,format:e,alphaMode:"opaque",size:[i.width,i.height]}),this._ctxMap.set(i,{ctx:t,size:[i.width,i.height]})}initBlitRender(){this.sampler||(this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),this.bgl2D||(this.bgl2D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),this.pipeline2D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl2D]}),vertex:{module:this.device.createShaderModule({code:Q}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:Q}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}}),this.blit2DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})),this.bgl3D||(this.bgl3D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"3d"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),this.pipeline3D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl3D]}),vertex:{module:this.device.createShaderModule({code:J}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:J}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}}),this.blit3DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}))}_renderCommonCanvasSetup(i,e){let t="bgra8unorm",r=this._ctxMap.get(i);if(r){let l=i.width|0,s=i.height|0;(r.size[0]!==l||r.size[1]!==s)&&(r.size=[l,s],r.ctx.configure({device:this.device,format:t,alphaMode:"opaque",size:r.size}))}else{let l=i.getContext("webgpu"),s=[i.width|0,i.height|0];l.configure({device:this.device,format:t,alphaMode:"opaque",size:s}),r={ctx:l,size:s},this._ctxMap.set(i,r)}let a=this.device.createCommandEncoder(),n=a.beginRenderPass({colorAttachments:[{view:r.ctx.getCurrentTexture().createView(),loadOp:e?"clear":"load",clearValue:{r:0,g:0,b:0,a:1},storeOp:"store"}]});return{enc:a,pass:n,ctxEntry:r}}renderTextureToCanvas(i,e,t={}){let{layer:r=0,channel:a=0,preserveCanvasSize:n=!0,clear:l=!0}=t;if(this.initBlitRender(),!n)try{let m=i.texture;m&&typeof m.width=="number"&&typeof m.height=="number"&&(e.width=m.width,e.height=m.height)}catch{}let s=new Uint32Array([r>>>0,a>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,s.buffer,s.byteOffset,s.byteLength);let p=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:i},{binding:2,resource:{buffer:this.blit2DUbo}}]}),{enc:c,pass:u}=this._renderCommonCanvasSetup(e,l);u.setPipeline(this.pipeline2D),u.setBindGroup(0,p),u.draw(6,1,0,0),u.end(),this.queue.submit([c.finish()])}renderTexture3DSliceToCanvas(i,e,t={}){let{depth:r,slice:a=0,zNorm:n=null,channel:l=0,chunk:s=0,preserveCanvasSize:p=!0,clear:c=!0}=t;this.initBlitRender();let u,m;if(i&&i.views&&Array.isArray(i.views)?(u=i.views[Math.max(0,Math.min(s|0,i.views.length-1))],m=i.meta?.tile?.d??r):(u=i,m=r),!u||!m)throw new Error("renderTexture3DSliceToCanvas: need a 3D view and its depth");if(!p)try{let P=u.texture;P&&typeof P.width=="number"&&typeof P.height=="number"&&(e.width=P.width,e.height=P.height)}catch{}let x=n??(Math.min(Math.max(a,0),m-1)+.5)/m;x=Math.min(Math.max(x,0),1);let d=new ArrayBuffer(16),g=new DataView(d);g.setFloat32(0,x,!0),g.setUint32(4,l>>>0,!0),g.setUint32(8,0,!0),g.setUint32(12,0,!0),this.queue.writeBuffer(this.blit3DUbo,0,d);let v=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:u},{binding:2,resource:{buffer:this.blit3DUbo}}]}),{enc:_,pass:D}=this._renderCommonCanvasSetup(e,c);D.setPipeline(this.pipeline3D),D.setBindGroup(0,v),D.draw(6,1,0,0),D.end(),this.queue.submit([_.finish()])}async export2DTextureToPNGBlob(i,e,t,r={}){if(!i)throw new Error("export2DTextureToPNGBlob: textureView is required");let a=Math.max(1,e|0),n=Math.max(1,t|0),l=r.layer??0,s=r.channel??0;if(this.initBlitRender(),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch(f){console.warn("export2DTextureToPNGBlob: onSubmittedWorkDone before export failed",f)}let c=this.device.createTexture({size:[a,n,1],format:"bgra8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),u=new Uint32Array([l>>>0,s>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,u.buffer,u.byteOffset,u.byteLength);let m=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:i},{binding:2,resource:{buffer:this.blit2DUbo}}]}),x=this.device.createCommandEncoder(),d=x.beginRenderPass({colorAttachments:[{view:c.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});d.setPipeline(this.pipeline2D),d.setBindGroup(0,m),d.draw(6,1,0,0),d.end();let g=4,v=256,_=a*g,D=Math.ceil(_/v)*v,P=D*n,B=this.device.createBuffer({size:P,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});x.copyTextureToBuffer({texture:c},{buffer:B,bytesPerRow:D,rowsPerImage:n},{width:a,height:n,depthOrArrayLayers:1}),this.queue.submit([x.finish()]),this.queue&&this.queue.onSubmittedWorkDone&&await this.queue.onSubmittedWorkDone(),await B.mapAsync(GPUMapMode.READ);let M=B.getMappedRange(),q=new Uint8Array(M),C=new Uint8ClampedArray(a*n*g),R=!0,A=0;for(let f=0;f<n;f++){let z=f*D;for(let b=0;b<a;b++){let w=z+b*4;R?(C[A++]=q[w+2],C[A++]=q[w+1],C[A++]=q[w+0],C[A++]=q[w+3]):(C[A++]=q[w+0],C[A++]=q[w+1],C[A++]=q[w+2],C[A++]=q[w+3])}}B.unmap(),B.destroy(),c.destroy();let N=document.createElement("canvas");N.width=a,N.height=n;let S=N.getContext("2d");if(!S)throw new Error("export2DTextureToPNGBlob: unable to get 2D context");let y=new ImageData(C,a,n);return S.putImageData(y,0,0),await new Promise((f,z)=>{N.toBlob(b=>{b?f(b):z(new Error("export2DTextureToPNGBlob: toBlob returned null"))},"image/png")})}async exportCurrent2DToPNGBlob(i,e,t={}){let r=this.getCurrentView();if(!r)throw new Error("exportCurrent2DToPNGBlob: no active 2D texture view");return this.export2DTextureToPNGBlob(r,i,e,t)}async export3DSliceToPNGBlob(i,e,t,r={}){if(!i)throw new Error("export3DSliceToPNGBlob: target is required");let a=Math.max(1,e|0),n=Math.max(1,t|0),{depth:l,slice:s=0,zNorm:p=null,channel:c=0,chunk:u=0}=r;if(!l||l<=0)throw new Error("export3DSliceToPNGBlob: depth must be provided and > 0");if(this.initBlitRender(),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch(E){console.warn("export3DSliceToPNGBlob: onSubmittedWorkDone before export failed",E)}let m,x;if(i&&i.views&&Array.isArray(i.views)){let E=Math.max(0,Math.min(u|0,i.views.length-1));m=i.views[E],x=i.meta?.tile?.d??l}else m=i,x=l;if(!m||!x)throw new Error("export3DSliceToPNGBlob: need a 3D view and its depth");let d=p??(Math.min(Math.max(s,0),x-1)+.5)/x;d=Math.min(Math.max(d,0),1);let v=this.device.createTexture({size:[a,n,1],format:"bgra8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),_=new ArrayBuffer(16),D=new DataView(_);D.setFloat32(0,d,!0),D.setUint32(4,c>>>0,!0),D.setUint32(8,0,!0),D.setUint32(12,0,!0),this.queue.writeBuffer(this.blit3DUbo,0,_);let P=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:m},{binding:2,resource:{buffer:this.blit3DUbo}}]}),B=this.device.createCommandEncoder(),M=B.beginRenderPass({colorAttachments:[{view:v.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});M.setPipeline(this.pipeline3D),M.setBindGroup(0,P),M.draw(6,1,0,0),M.end();let q=4,C=256,R=a*q,A=Math.ceil(R/C)*C,N=A*n,S=this.device.createBuffer({size:N,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});B.copyTextureToBuffer({texture:v},{buffer:S,bytesPerRow:A,rowsPerImage:n},{width:a,height:n,depthOrArrayLayers:1}),this.queue.submit([B.finish()]),this.queue&&this.queue.onSubmittedWorkDone&&await this.queue.onSubmittedWorkDone(),await S.mapAsync(GPUMapMode.READ);let y=S.getMappedRange(),h=new Uint8Array(y),f=new Uint8ClampedArray(a*n*q),z=!0,b=0;for(let E=0;E<n;E++){let L=E*A;for(let W=0;W<a;W++){let k=L+W*4;z?(f[b++]=h[k+2],f[b++]=h[k+1],f[b++]=h[k+0],f[b++]=h[k+3]):(f[b++]=h[k+0],f[b++]=h[k+1],f[b++]=h[k+2],f[b++]=h[k+3])}}S.unmap(),S.destroy(),v.destroy();let w=document.createElement("canvas");w.width=a,w.height=n;let G=w.getContext("2d");if(!G)throw new Error("export3DSliceToPNGBlob: unable to get 2D context");let V=new ImageData(f,a,n);return G.putImageData(V,0,0),await new Promise((E,L)=>{w.toBlob(W=>{W?E(W):L(new Error("export3DSliceToPNGBlob: toBlob returned null"))},"image/png")})}async _render3DSliceToRGBA8Pixels(i,e,t,r,a=0){if(!i)throw new Error("_render3DSliceToRGBA8Pixels: view3D is required");let n=Math.max(1,e|0),l=Math.max(1,t|0);this.initBlitRender();let s=Math.min(Math.max(Number(r)||0,0),1),c=this.device.createTexture({size:[n,l,1],format:"bgra8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),u=new ArrayBuffer(16),m=new DataView(u);m.setFloat32(0,s,!0),m.setUint32(4,a>>>0,!0),m.setUint32(8,0,!0),m.setUint32(12,0,!0),this.queue.writeBuffer(this.blit3DUbo,0,u);let x=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:i},{binding:2,resource:{buffer:this.blit3DUbo}}]}),d=this.device.createCommandEncoder(),g=d.beginRenderPass({colorAttachments:[{view:c.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});g.setPipeline(this.pipeline3D),g.setBindGroup(0,x),g.draw(6,1,0,0),g.end();let v=4,_=256,D=n*v,P=Math.ceil(D/_)*_,B=P*l,M=this.device.createBuffer({size:B,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});d.copyTextureToBuffer({texture:c},{buffer:M,bytesPerRow:P,rowsPerImage:l},{width:n,height:l,depthOrArrayLayers:1}),this.queue.submit([d.finish()]),this.queue&&this.queue.onSubmittedWorkDone&&await this.queue.onSubmittedWorkDone(),await M.mapAsync(GPUMapMode.READ);let q=M.getMappedRange(),C=new Uint8Array(q),R=new Uint8ClampedArray(n*l*v),A=0;for(let N=0;N<l;N++){let S=N*P;for(let y=0;y<n;y++){let h=S+y*4;R[A++]=C[h+2],R[A++]=C[h+1],R[A++]=C[h+0],R[A++]=C[h+3]}}return M.unmap(),M.destroy(),c.destroy(),R}async export3DTilesetToPNGBlob(i,e,t,r={}){if(!i)throw new Error("export3DTilesetToPNGBlob: target is required");let a=Math.max(1,e|0),n=Math.max(1,(t??e)|0),{depth:l,channel:s=0,chunk:p=0,tilesAcross:c=16,tilesDown:u=null,startSlice:m=0,sliceCount:x=null}=r;if(this.initBlitRender(),this.queue&&this.queue.onSubmittedWorkDone)try{await this.queue.onSubmittedWorkDone()}catch(S){console.warn("export3DTilesetToPNGBlob: onSubmittedWorkDone before export failed",S)}let d,g;if(i&&i.views&&Array.isArray(i.views)){let S=Math.max(0,Math.min(p|0,i.views.length-1));d=i.views[S],g=i.meta?.tile?.d??l}else d=i,g=l;if(!d)throw new Error("export3DTilesetToPNGBlob: missing 3D view");if(!g||g<=0)throw new Error("export3DTilesetToPNGBlob: depth must be provided and > 0");let v=Math.max(1,c|0),_=u!=null?Math.max(1,u|0):Math.ceil(g/v),D=Math.min(Math.max(m|0,0),g-1),P=x!=null?Math.max(0,x|0):g-D,B=a*v,M=n*_,q=new Uint8ClampedArray(B*M*4),C=Math.min(g,D+P);for(let S=D;S<C;S++){let y=S-D,h=y%v,f=y/v|0;if(f>=_)break;let z=(S+.5)/g,b=await this._render3DSliceToRGBA8Pixels(d,a,n,z,s),w=h*a,G=f*n;for(let V=0;V<n;V++){let F=V*a*4,E=((G+V)*B+w)*4;q.set(b.subarray(F,F+a*4),E)}}let R=document.createElement("canvas");R.width=B,R.height=M;let A=R.getContext("2d");if(!A)throw new Error("export3DTilesetToPNGBlob: unable to get 2D context");return A.putImageData(new ImageData(q,B,M),0,0),await new Promise((S,y)=>{R.toBlob(h=>{h?S(h):y(new Error("export3DTilesetToPNGBlob: toBlob returned null"))},"image/png")})}},ie=class{constructor(i=Date.now()){i<1e7&&(i*=1e7),this.seedN=i,this.seedK=i,this.perm=new Uint8Array(512),this.seed(i)}seed(i){let e=this.xorshift(i);for(let t=0;t<256;t++)this.perm[t]=t;for(let t=255;t>0;t--){let r=Math.floor(e()*(t+1));[this.perm[t],this.perm[r]]=[this.perm[r],this.perm[t]]}for(let t=0;t<256;t++)this.perm[t+256]=this.perm[t]}setSeed(i){this.seedN=i,this.seed(i),this.resetSeed()}random(i,e,t){let r;return typeof t=="number"?r=this.perm[(i&255)+this.perm[(e&255)+this.perm[t&255]]]&255:r=this.perm[(i&255)+this.perm[e&255]]&255,this.perm[r]/255*2-1}seededRandom(){this.seedK+=Math.E;let i=1e9*Math.sin(this.seedK);return i-Math.floor(i)}resetSeed(){this.seedK=this.seedN}xorshift(i){let e=i;return function(){return e^=e<<13,e^=e>>17,e^=e<<5,(e<0?1+~e:e)/4294967295}}dot(i,e=0,t=0,r=0){return i[0]*e+i[1]*t+i[2]*r}};document.body.insertAdjacentHTML("afterbegin",ne);var Me=6,Pe={computeCellular:"CellularPattern",computeWorley:"WorleyPattern",computeAntiCellular:"AntiCellularPattern",computeAntiWorley:"AntiWorleyPattern",computeWhiteNoise:"White Noise",computeBlueNoise:"Blue Noise"},Ce={computeRidge:{clamp:{freq:[.25,8],gain:[.2,.8],octaves:[1,12]}},computeAntiRidge:{clamp:{freq:[.25,8],gain:[.2,.8],octaves:[1,12]}},computeRidgedMultifractal:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal2:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal3:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal4:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeFBM:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeFBM2:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeFBM3:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeVoronoiBM1:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeVoronoiBM2:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeVoronoiBM3:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeCellular:{clamp:{threshold:[0,1]}},computeWorley:{clamp:{threshold:[0,1]}},computeAntiCellular:{clamp:{threshold:[0,1]}},computeAntiWorley:{clamp:{threshold:[0,1]}},computeSimplexFBM:{force:{turbulence:1},clamp:{warpAmp:[.1,2],freq:[.25,6]}},computeCurl2D:{force:{turbulence:1},clamp:{warpAmp:[.1,2],freq:[.25,6]}},computeCurlFBM2D:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeDomainWarpFBM1:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeDomainWarpFBM2:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeGaborAnisotropic:{clamp:{gaborRadius:[.5,6]}},computeFoamNoise:{force:{turbulence:1},clamp:{gain:[.5,.95]}}},T=128,fe="toroidalDemo",Z=new Map,I=[],H=Object.create(null);function K(o){let i=String(o||""),e=Pe[i];if(e)return e;let t=i;return t.startsWith("compute")&&(t=t.slice(7)),t||i}function Ae(o,i){let e=Object.create(null),t=Array.isArray(o)?o:[],r=Math.max(0,i|0),a=Math.max(0,t.length-r);for(let n=0;n<a;n++)e[n]=K(t[n]);return e}function Te(){return Object.keys(H).map(o=>Number(o)).filter(o=>Number.isInteger(o)&&o>=0).sort((o,i)=>o-i)}function qe(){let o=[];for(let i=0;i<I.length;i++){let e=I[i];typeof e!="string"||!e||e!=="clearTexture"&&o.push(i)}return o}function Ne(o){let i=I[o];return i&&Ce[String(i)]||null}function Y(o,i,e,t){if(!Object.prototype.hasOwnProperty.call(o,i))return;let r=Number(o[i]);if(!Number.isFinite(r))return;let a=Number(e),n=Number(t);o[i]=Math.min(Math.max(r,a),n)}function me(o,i){let e={...i},t=Ne(o);if(t&&t.clamp){let a=t.clamp;a.freq&&Y(e,"freq",a.freq[0],a.freq[1]),a.gain&&Y(e,"gain",a.gain[0],a.gain[1]),a.octaves&&Y(e,"octaves",a.octaves[0],a.octaves[1]),a.threshold&&Y(e,"threshold",a.threshold[0],a.threshold[1]),a.warpAmp&&Y(e,"warpAmp",a.warpAmp[0],a.warpAmp[1]),a.gaborRadius&&Y(e,"gaborRadius",a.gaborRadius[0],a.gaborRadius[1]),a.edgeK&&Y(e,"edgeK",a.edgeK[0],a.edgeK[1])}if(t&&t.force)for(let[a,n]of Object.entries(t.force))e[a]=n;let r=Z.get(o);if(r)for(let[a,n]of Object.entries(r))typeof n=="number"&&Number.isFinite(n)&&(e[a]=n);return e}function ae(){let o=(a,n)=>{let l=document.getElementById(a);if(!l)return n;let s=Number(l.value);return Number.isFinite(s)?s:n},i=(a,n)=>{let l=o(a,n);return Number.isFinite(l)?Math.max(0,Math.floor(l)):n},e=Math.max(1,Math.floor(o("noise-seed",1234567890))),t=document.getElementById("noise-turbulence"),r=t&&t.checked?1:0;return{seed:e,zoom:o("noise-zoom",1),freq:o("noise-freq",1),octaves:Math.max(1,Math.floor(o("noise-octaves",8))),lacunarity:o("noise-lacunarity",2),gain:o("noise-gain",.5),xShift:o("noise-xShift",0),yShift:o("noise-yShift",0),zShift:o("noise-zShift",0),turbulence:r,seedAngle:o("noise-seedAngle",0),exp1:o("noise-exp1",1),exp2:o("noise-exp2",0),threshold:o("noise-threshold",.1),rippleFreq:o("noise-rippleFreq",10),time:o("noise-time",0),warpAmp:o("noise-warpAmp",.5),gaborRadius:o("noise-gaborRadius",4),terraceStep:o("noise-terraceStep",8),toroidal:0,voroMode:i("noise-voroMode",0),edgeK:o("noise-edgeK",0)}}function Re(){let o=document.querySelectorAll('input[type="checkbox"][name="noise-type"]'),i=[];return o.forEach(e=>{if(e.checked){let t=Number(e.dataset.bit);Number.isInteger(t)&&i.push(t)}}),i}function de(){let o=document.getElementById("z-slice"),i=document.getElementById("z-slice-num"),e=0;return o?e=Number(o.value):i&&(e=Number(i.value)),Number.isFinite(e)||(e=0),e=Math.min(Math.max(Math.round(e),0),T-1),o&&String(o.value)!==String(e)&&(o.value=String(e)),i&&String(i.value)!==String(e)&&(i.value=String(e)),e}function $(o,i,e){o.style.width=`${i}px`,o.style.height=`${e}px`,o.style.display="block",o.style.margin="0",o.style.padding="0",o.style.border="0",o.style.outline="0",o.style.background="transparent",o.style.imageRendering="crisp-edges",o.style.imageRendering="pixelated"}function ge(o,i,e,t){let r=e|0,a=t|0;return $(i,r,a),i.width!==r||i.height!==a?(i.width=r,i.height=a,o&&typeof o.configureCanvas=="function"&&o.configureCanvas(i),!0):!1}function Ee(o,i,e,t){let r=Math.max(1,t|0),a=Math.max(1,Math.round(Math.sqrt(r))),n=Math.ceil(r/a);o.style.display="grid",o.style.gridTemplateColumns=`repeat(${a}, ${i}px)`,o.style.gridAutoRows=`${e}px`,o.style.gap="0px",o.style.padding="0",o.style.margin="0",o.style.border="0",o.style.lineHeight="0",o.style.fontSize="0",o.style.alignItems="start",o.style.justifyItems="start",o.style.placeItems="start",o.style.overflow="hidden"}function ke(){let o=document.getElementById("noise-canvas"),i=document.getElementById("view-stack");if(!o&&i&&(o=document.createElement("canvas"),o.id="noise-canvas",o.width=800,o.height=800,i.appendChild(o)),!o)throw new Error("Missing main preview canvas (#noise-canvas)");$(o,o.width,o.height);let e=document.getElementById("mosaic");if(!e)throw new Error("Missing #mosaic container");let t=[],r=e.querySelectorAll("canvas");if(r.length)r.forEach(a=>{$(a,a.width||T,a.height||T),t.push(a)});else for(let a=0;a<9;a++){let n=document.createElement("canvas");n.width=T,n.height=T,$(n,T,T),e.appendChild(n),t.push(n)}return Ee(e,T,T,t.length||9),{mainCanvas:o,mosaicCanvases:t}}function Ge(o){return o.length?o.map(e=>H[e]||String(e)).join(", "):H[0]||"Perlin"}function ve(o){let i=document.getElementById(o);if(!i)throw new Error(`Missing #${o}`);return i}function Ve(){let o=ve("noise-type-list");o.innerHTML="";let i=Te();for(let e of i){let t=document.createElement("label"),r=document.createElement("input");r.type="checkbox",r.name="noise-type",r.dataset.bit=String(e),e===0&&(r.checked=!0),t.appendChild(r),t.appendChild(document.createTextNode(" "+(H[e]||String(e)))),o.appendChild(t)}}function Le(o){return(Array.isArray(o)?o:[]).filter(e=>typeof e=="string"&&/4D/.test(e)&&e!=="clearTexture").slice()}function Fe(o){let i=ve("toroidal-type-list");i.innerHTML="";let e=Le(o),t=new Set(["computePerlin4D","computeWorley4D"]),r=!1;for(let a of e){let n=document.createElement("label"),l=document.createElement("input");l.type="checkbox",l.name="toroidal-type",l.dataset.entry=a;let s=I.indexOf(a);Number.isInteger(s)&&s>=0&&(l.dataset.bit=String(s)),t.has(a)&&(l.checked=!0,r=!0),n.appendChild(l),n.appendChild(document.createTextNode(" "+K(a))),i.appendChild(n)}if(!r&&e.length){let a=i.querySelector('input[type="checkbox"][name="toroidal-type"]');a&&(a.checked=!0)}}function re(){let o=document.querySelectorAll('input[type="checkbox"][name="toroidal-type"]'),i=[];if(o.forEach(e=>{if(!e.checked)return;let t=String(e.dataset.entry||"");if(!t)return;let r=Number(e.dataset.bit);Number.isInteger(r)||(r=I.indexOf(t)),Number.isInteger(r)||(r=-1),i.push({bit:r,entry:t})}),!i.length){let e=["computePerlin4D","computeWorley4D"];for(let t of e){if(!I.includes(t))continue;let r=I.indexOf(t);i.push({bit:r,entry:t})}}return i}function xe(o){let i=document.getElementById("mosaic-caption");if(!i)return;let e=Array.isArray(o)?o:[],t=e.length?e.map(r=>K(r)).join(" + "):"None";i.textContent=`A single toroidal Z slice from a 4D volume. Modes: ${t}. Repeated in X and Y. Use the Z slice control to see different slices.`}function Ie(){let o=document.getElementById("override-mode");if(!o)return;o.innerHTML="";let i=qe();for(let e of i){let t=I[e],r=document.createElement("option");r.value=String(e),r.textContent=`${e}: ${K(t)}`,o.appendChild(r)}i.length&&(o.value=String(i[0]))}function te(o){let i=Z.get(o)||{},e=(r,a)=>{let n=document.getElementById(r);if(!n)return;let l=i[a];n.value=typeof l=="number"&&Number.isFinite(l)?String(l):""},t=(r,a)=>{let n=document.getElementById(r);if(!n)return;let l=i[a];n.value=typeof l=="number"&&Number.isFinite(l)?String(l):""};e("ov-zoom","zoom"),e("ov-freq","freq"),e("ov-lacunarity","lacunarity"),e("ov-gain","gain"),e("ov-octaves","octaves"),t("ov-turbulence","turbulence"),e("ov-seedAngle","seedAngle"),e("ov-exp1","exp1"),e("ov-exp2","exp2"),e("ov-rippleFreq","rippleFreq"),e("ov-time","time"),e("ov-warp","warpAmp"),e("ov-threshold","threshold"),t("ov-voroMode","voroMode"),e("ov-edgeK","edgeK"),e("ov-gabor","gaborRadius"),e("ov-terraceStep","terraceStep"),e("ov-xShift","xShift"),e("ov-yShift","yShift"),e("ov-zShift","zShift")}function We(){let o=document.getElementById("override-mode");if(!o)return;let i=Number(o.value);if(!Number.isInteger(i))return;let e=A=>{let N=document.getElementById(A);if(!N)return null;let S=String(N.value).trim();if(!S)return null;let y=Number(S);return Number.isFinite(y)?y:null},t=A=>{let N=document.getElementById(A);if(!N)return null;let S=String(N.value).trim();if(!S)return null;let y=Number(S);return Number.isFinite(y)?y:null},r={},a=e("ov-zoom"),n=e("ov-freq"),l=e("ov-lacunarity"),s=e("ov-gain"),p=e("ov-octaves"),c=t("ov-turbulence"),u=e("ov-seedAngle"),m=e("ov-exp1"),x=e("ov-exp2"),d=e("ov-rippleFreq"),g=e("ov-time"),v=e("ov-warp"),_=e("ov-threshold"),D=t("ov-voroMode"),P=e("ov-edgeK"),B=e("ov-gabor"),M=e("ov-terraceStep"),q=e("ov-xShift"),C=e("ov-yShift"),R=e("ov-zShift");a!==null&&(r.zoom=a),n!==null&&(r.freq=n),l!==null&&(r.lacunarity=l),s!==null&&(r.gain=s),p!==null&&(r.octaves=p),c!==null&&(r.turbulence=Math.max(0,Math.floor(c))),u!==null&&(r.seedAngle=u),m!==null&&(r.exp1=m),x!==null&&(r.exp2=x),d!==null&&(r.rippleFreq=d),g!==null&&(r.time=g),v!==null&&(r.warpAmp=v),_!==null&&(r.threshold=_),D!==null&&(r.voroMode=Math.max(0,Math.floor(D))),P!==null&&(r.edgeK=P),B!==null&&(r.gaborRadius=B),M!==null&&(r.terraceStep=M),q!==null&&(r.xShift=q),C!==null&&(r.yShift=C),R!==null&&(r.zShift=R),Object.keys(r).length?Z.set(i,r):Z.delete(i)}function pe(o){return typeof o=="string"&&/4D/.test(o)}async function ue(o,i){let e=Number(document.getElementById("res-width")?.value)||800,t=Number(document.getElementById("res-height")?.value)||800;ge(o,i,e,t);let r=document.getElementById("preview-meta"),a=document.getElementById("preview-stats"),n=ae();o.buildPermTable(n.seed|0);let l=Re(),s=l.length?l:[0],p={getGradient:0,outputChannel:1,baseRadius:0,heightScale:1,useCustomPos:0},c=performance.now();await o.computeToTexture(e,t,n,{...p,noiseChoices:["clearTexture"],frameFullWidth:e,frameFullHeight:t});for(let g of s){let v=I[g],_=me(g,n);pe(v)?_.toroidal=1:_.toroidal=0,await o.computeToTexture(e,t,_,{...p,noiseChoices:[g],frameFullWidth:e,frameFullHeight:t})}let u=performance.now(),m=o.getCurrentView(),x=performance.now();m&&o.renderTextureToCanvas(m,i,{layer:0,channel:0,preserveCanvasSize:!0,clear:!0});let d=performance.now();if(r){let v=s.some(_=>pe(I[_]))?" \xB7 toroidal(4D)":"";r.textContent=`Height field preview \xB7 ${e}\xD7${t} \xB7 modes: ${Ge(s)}${v}`}if(a){let g=(u-c).toFixed(1),v=(d-x).toFixed(1);a.textContent=`GPU compute ${g} ms \xB7 blit ${v} ms`}return{resW:e,resH:t,noiseBits:s}}function he(o,i,e){if(!i)return;let t=T,a=(de()+.5)/t,n=Array.isArray(e)?e:[],l=n.length||9;for(let s=0;s<l;s++){let p=n[s];p&&(ge(o,p,T,T),o.renderTexture3DSliceToCanvas(i,p,{depth:t,zNorm:a,channel:0,chunk:0,preserveCanvasSize:!0,clear:!0}))}}async function ce(o,i,e){let t=ae();o.buildPermTable(t.seed|0);let r={...t,toroidal:1},a=re();xe(a.map(p=>p.entry));let n=performance.now(),l=await o.computeToTexture3D(T,T,T,r,{noiseChoices:["clearTexture"],outputChannel:1,id:fe});for(let p of a){let c=p.bit,u=p.entry,m=Number.isInteger(c)&&c>=0?me(c,r):{...r};l=await o.computeToTexture3D(T,T,T,m,{noiseChoices:[u],outputChannel:1,id:fe})}let s=performance.now();e.lastToroidalVolumeView=l,e.lastToroidalComputeMs=s-n,he(o,l,new Array(9).fill(0).map((p,c)=>i[c]))}async function Ue(){let o=document.getElementById("preview-stats");if(!navigator.gpu){console.error("WebGPU not available in this browser."),o&&(o.textContent="WebGPU not available in this browser.");return}let i=await navigator.gpu.requestAdapter();if(!i){console.error("Failed to get GPU adapter."),o&&(o.textContent="Failed to get GPU adapter.");return}let e=await i.requestDevice(),t=new j(e,e.queue);I=Array.isArray(t.entryPoints)?t.entryPoints.slice():[],H=Ae(I,Me),Ve(),Fe(I),Ie();let{mainCanvas:r,mosaicCanvases:a}=ke();t.configureCanvas(r),a.forEach(f=>t.configureCanvas(f));let n=document.getElementById("override-mode");if(n){let f=Number(n.value);Number.isInteger(f)&&te(f)}let l={lastToroidalVolumeView:null,lastToroidalComputeMs:0},s=!1,p=!1,c=()=>{s||(s=!0,requestAnimationFrame(()=>{s=!1,ue(t,r).catch(f=>{console.error(f),o&&(o.textContent=String(f))})}))},u=()=>{p||(p=!0,requestAnimationFrame(()=>{p=!1,ce(t,a,l).catch(f=>{console.error(f),o&&(o.textContent=String(f))})}))},m=()=>{c(),u()};["ov-zoom","ov-freq","ov-lacunarity","ov-gain","ov-octaves","ov-turbulence","ov-seedAngle","ov-exp1","ov-exp2","ov-rippleFreq","ov-time","ov-warp","ov-threshold","ov-voroMode","ov-edgeK","ov-gabor","ov-terraceStep","ov-xShift","ov-yShift","ov-zShift"].forEach(f=>{let z=document.getElementById(f);z&&z.addEventListener("change",()=>{We(),c(),u()})}),n&&n.addEventListener("change",()=>{let f=Number(n.value);Number.isInteger(f)&&te(f)});let d=document.getElementById("ov-clear");d&&d.addEventListener("click",()=>{let f=document.getElementById("override-mode");if(!f)return;let z=Number(f.value);Number.isInteger(z)&&(Z.delete(z),te(z),c(),u())});let g=document.getElementById("render-btn");g&&g.addEventListener("click",()=>{m()});let v=document.getElementById("apply-res");v&&v.addEventListener("click",()=>{m()}),["noise-seed","noise-zoom","noise-freq","noise-octaves","noise-lacunarity","noise-gain","noise-xShift","noise-yShift","noise-zShift","noise-voroMode","noise-threshold","noise-edgeK","noise-seedAngle","noise-turbulence","noise-time","noise-warpAmp","noise-gaborRadius","noise-terraceStep","noise-exp1","noise-exp2","noise-rippleFreq"].forEach(f=>{let z=document.getElementById(f);z&&(z.addEventListener("input",()=>{c(),u()}),z.addEventListener("change",()=>{c(),u()}))});let D=document.getElementById("noise-type-list");D&&D.addEventListener("change",f=>{let z=f.target;!z||z.name!=="noise-type"||c()});let P=document.getElementById("toroidal-type-list");P&&P.addEventListener("change",f=>{let z=f.target;!z||z.name!=="toroidal-type"||u()});let B=document.getElementById("z-slice"),M=document.getElementById("z-slice-num"),q=()=>{l.lastToroidalVolumeView&&he(t,l.lastToroidalVolumeView,a)};B&&B.addEventListener("input",()=>{let f=Number(B.value);M&&(M.value=String(f)),q()}),M&&M.addEventListener("change",()=>{let f=Number(M.value);Number.isFinite(f)||(f=0),f=Math.min(Math.max(Math.round(f),0),T-1),M.value=String(f),B&&(B.value=String(f)),q()});let C=document.getElementById("download-main");C&&C.addEventListener("click",async()=>{try{let f=Number(document.getElementById("res-width")?.value)||800,z=Number(document.getElementById("res-height")?.value)||800,b=await t.exportCurrent2DToPNGBlob(f,z,{layer:0,channel:0}),w=URL.createObjectURL(b),G=document.createElement("a");G.href=w,G.download="noise-main.png",document.body.appendChild(G),G.click(),G.remove(),URL.revokeObjectURL(w)}catch(f){console.error("download-main failed:",f),o&&(o.textContent="Export main PNG failed: "+f)}});let R=document.getElementById("download-tile");R&&R.addEventListener("click",async()=>{try{if(!l.lastToroidalVolumeView){console.warn("No toroidal volume available for export");return}let f=(a&&a.length?a[0]:null)||document.getElementById("tile-canvas");if(!f){console.warn("No tile canvas found for export");return}let z=f.width||T,b=f.height||T,w=T,V=(de()+.5)/w,F=await t.export3DSliceToPNGBlob(l.lastToroidalVolumeView,z,b,{depth:w,zNorm:V,channel:0,chunk:0}),E=URL.createObjectURL(F),L=document.createElement("a");L.href=E,L.download="noise-tile.png",document.body.appendChild(L),L.click(),L.remove(),URL.revokeObjectURL(E)}catch(f){console.error("download-tile failed:",f),o&&(o.textContent="Export tile PNG failed: "+f)}});function A(f,z){let b=URL.createObjectURL(f),w=document.createElement("a");w.href=b,w.download=z,document.body.appendChild(w),w.click(),w.remove(),URL.revokeObjectURL(b)}function N(f){return String(f||"").trim().replace(/\s+/g,"_").replace(/[^a-zA-Z0-9._-]+/g,"").slice(0,120)}async function S(f,z,b){let w=Math.max(1,b.tileW|0),G=Math.max(1,b.tileH|0),V=Math.max(1,b.depth|0),F=Math.max(1,b.columns|0),E=Math.ceil(V/F),L=Number.isFinite(b.channel)?b.channel|0:0,W=Number.isFinite(b.chunk)?b.chunk|0:0,k=document.createElement("canvas");k.width=w*F,k.height=G*E;let X=k.getContext("2d",{alpha:!0});if(!X)throw new Error("Failed to create 2D context for atlas canvas");X.clearRect(0,0,k.width,k.height);let U=document.createElement("canvas");U.width=w,U.height=G,f.configureCanvas(U);for(let O=0;O<V;O++){let ye=(O+.5)/V;f.renderTexture3DSliceToCanvas(z,U,{depth:V,zNorm:ye,channel:L,chunk:W,preserveCanvasSize:!0,clear:!0}),f.queue&&typeof f.queue.onSubmittedWorkDone=="function"&&await f.queue.onSubmittedWorkDone();let ze=O%F*w,be=Math.floor(O/F)*G;X.drawImage(U,ze,be)}let oe=await new Promise(O=>k.toBlob(O,"image/png"));if(!oe)throw new Error("Failed to encode atlas PNG");return{blob:oe,cols:F,rows:E,width:k.width,height:k.height}}async function y(f,z){if(!z||!z.lastToroidalVolumeView){console.warn("No toroidal volume available for tileset export");return}let b=ae(),w=re().map(U=>U.entry),G=16,V=T,F=T,E=T,L=await S(f,z.lastToroidalVolumeView,{tileW:V,tileH:F,depth:E,columns:G,channel:0,chunk:0}),W=N(w.map(K).join("+"))||"tileset",k=N(b.seed),X=`noise-tileset_${W}_seed${k}_${V}x${F}_z${E}_${L.cols}x${L.rows}.png`;A(L.blob,X)}let h=document.getElementById("download-tileset");h&&h.addEventListener("click",async()=>{try{await y(t,l)}catch(f){console.error("download-tileset failed:",f),o&&(o.textContent="Export tileset failed: "+f)}}),xe(re().map(f=>f.entry)),await ue(t,r),await ce(t,a,l)}document.addEventListener("DOMContentLoaded",()=>{Ue().catch(o=>console.error(o))});})();
