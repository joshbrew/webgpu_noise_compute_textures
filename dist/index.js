(()=>{var noiseComponent_default='<!-- tools/noise/noiseComponent.html -->\r\n<div id="noise-app">\r\n  <style>\r\n    :root {\r\n      background-color: #000;\r\n      color-scheme: dark;\r\n\r\n      --gap: 16px;\r\n      --gap-sm: 10px;\r\n\r\n      --accent: #3fa9ff;\r\n      --accent-soft: rgba(63, 169, 255, 0.2);\r\n\r\n      --panel-bg: #050505;\r\n      --panel-bg2: #111;\r\n\r\n      --sidebar-w: 340px; /* fixed sidebar width */\r\n      --canvas-min: 520px; /* min size for square canvas area */\r\n      --content-max: 1200px;\r\n\r\n      --radius: 10px;\r\n      --border: #202020;\r\n    }\r\n\r\n    * {\r\n      box-sizing: border-box;\r\n    }\r\n\r\n    html,\r\n    body {\r\n      height: 100%;\r\n      margin: 0;\r\n      background: #000;\r\n      color: #fff;\r\n      overflow-x: auto; /* allow collapse via horizontal scroll, not squish */\r\n      overflow-y: hidden;\r\n      font-family:\r\n        system-ui,\r\n        -apple-system,\r\n        BlinkMacSystemFont,\r\n        "Segoe UI",\r\n        sans-serif;\r\n      min-width: calc(var(--sidebar-w) + var(--canvas-min) + (var(--gap) * 3));\r\n    }\r\n\r\n    #noise-app {\r\n      height: 100dvh;\r\n      width: 100dvw;\r\n      display: flex;\r\n      gap: var(--gap);\r\n      padding: var(--gap);\r\n      overflow: hidden;\r\n      background: #000;\r\n      min-width: calc(var(--sidebar-w) + var(--canvas-min) + (var(--gap) * 3));\r\n    }\r\n\r\n    /* Sidebar */\r\n    aside#sidebar {\r\n      flex: 0 0 var(--sidebar-w);\r\n      width: var(--sidebar-w);\r\n      min-width: var(--sidebar-w);\r\n      max-width: var(--sidebar-w);\r\n\r\n      height: 100%;\r\n      overflow: auto;\r\n      padding: 10px 20px 20px 00px; /* extra right padding prevents focus glow clip */\r\n      scrollbar-gutter: stable both-edges;\r\n\r\n      background: radial-gradient(\r\n        circle at top,\r\n        #181818 0,\r\n        #050505 40%,\r\n        #000 100%\r\n      );\r\n      border-right: 1px solid #181818;\r\n\r\n      font-size: 14px;\r\n      z-index: 10;\r\n    }\r\n\r\n    .sidebar-header {\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 2px;\r\n      margin-bottom: 10px;\r\n      padding: 6px 4px 8px 4px;\r\n      border-bottom: 1px solid #202020;\r\n    }\r\n\r\n    .sidebar-title {\r\n      font-size: 14px;\r\n      font-weight: 600;\r\n      letter-spacing: 0.06em;\r\n      text-transform: uppercase;\r\n      color: #f5f5f5;\r\n    }\r\n\r\n    .sidebar-subtitle {\r\n      font-size: 11px;\r\n      color: #aaaaaa;\r\n    }\r\n\r\n    .sidebar-nav {\r\n      display: flex;\r\n      flex-wrap: wrap;\r\n      gap: 6px;\r\n      margin: 4px 0 10px 0;\r\n    }\r\n\r\n    .nav-pill {\r\n      padding: 4px 8px;\r\n      border-radius: 999px;\r\n      border: 1px solid #2b2b2b;\r\n      background: rgba(20, 20, 20, 0.95);\r\n      color: #d0d0d0;\r\n      font-size: 11px;\r\n      text-decoration: none;\r\n      cursor: pointer;\r\n      transition:\r\n        background 0.15s ease,\r\n        border-color 0.15s ease,\r\n        color 0.15s ease;\r\n    }\r\n\r\n    .nav-pill:hover {\r\n      border-color: var(--accent);\r\n      background: rgba(21, 80, 130, 0.9);\r\n      color: #ffffff;\r\n    }\r\n\r\n    /* Main area (no stretching; square stage) */\r\n    main#main {\r\n      flex: 1 1 auto;\r\n      min-width: var(--canvas-min);\r\n      height: 100%;\r\n      overflow: auto;\r\n      padding: 0;\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: var(--gap);\r\n      background: #000;\r\n    }\r\n\r\n    .content {\r\n      width: 100%;\r\n      max-width: var(--content-max);\r\n      margin: 0 auto;\r\n      min-width: 0;\r\n    }\r\n\r\n    #view-stack {\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 10px;\r\n      padding: var(--gap);\r\n      min-width: 0;\r\n    }\r\n\r\n    .preview-header {\r\n      display: flex;\r\n      align-items: baseline;\r\n      justify-content: space-between;\r\n      gap: 10px;\r\n      padding: 2px 4px 4px 4px;\r\n      font-size: 13px;\r\n      color: #ccc;\r\n    }\r\n\r\n    #preview-meta {\r\n      font-weight: 600;\r\n      color: #f5f5f5;\r\n      min-width: 0;\r\n      overflow: hidden;\r\n      text-overflow: ellipsis;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    #preview-stats {\r\n      font-variant-numeric: tabular-nums;\r\n      opacity: 0.85;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .squareWrap {\r\n      width: min(\r\n        calc(100vw - var(--sidebar-w) - (var(--gap) * 4)),\r\n        calc(100dvh - (var(--gap) * 3))\r\n      );\r\n      aspect-ratio: 1 / 1;\r\n      min-width: var(--canvas-min);\r\n      min-height: var(--canvas-min);\r\n\r\n      border-radius: var(--radius);\r\n      border: 1px solid var(--border);\r\n      background: #000;\r\n      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);\r\n      overflow: hidden;\r\n    }\r\n\r\n    /* Stage tabs */\r\n    .stage {\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 10px;\r\n      min-width: 0;\r\n    }\r\n\r\n    .stage input[type="radio"] {\r\n      position: absolute;\r\n      opacity: 0;\r\n      pointer-events: none;\r\n    }\r\n\r\n    .stage-tabs {\r\n      display: inline-flex;\r\n      gap: 6px;\r\n      padding: 6px;\r\n      border: 1px solid #202020;\r\n      border-radius: 999px;\r\n      background: rgba(10, 10, 10, 0.85);\r\n      width: fit-content;\r\n    }\r\n\r\n    .stage-tab {\r\n      display: inline-flex;\r\n      align-items: center;\r\n      justify-content: center;\r\n      padding: 6px 10px;\r\n      border-radius: 999px;\r\n      border: 1px solid #2b2b2b;\r\n      background: rgba(20, 20, 20, 0.95);\r\n      color: #d0d0d0;\r\n      font-size: 12px;\r\n      letter-spacing: 0.06em;\r\n      text-transform: uppercase;\r\n      cursor: pointer;\r\n      user-select: none;\r\n      transition:\r\n        background 0.15s ease,\r\n        border-color 0.15s ease,\r\n        color 0.15s ease;\r\n    }\r\n\r\n    .stage-tab:hover {\r\n      border-color: var(--accent);\r\n      background: rgba(21, 80, 130, 0.9);\r\n      color: #ffffff;\r\n    }\r\n\r\n    #view-tab-preview:checked ~ .stage-tabs label[for="view-tab-preview"],\r\n    #view-tab-tileset:checked ~ .stage-tabs label[for="view-tab-tileset"] {\r\n      border-color: var(--accent);\r\n      background: linear-gradient(135deg, #2575fc, #21c0ff);\r\n      color: #000;\r\n      font-weight: 700;\r\n    }\r\n\r\n    .squareWrap.stageWrap {\r\n      position: relative;\r\n    }\r\n\r\n    .stage-panel {\r\n      position: absolute;\r\n      inset: 0;\r\n      display: none;\r\n      width: 100%;\r\n      height: 100%;\r\n    }\r\n\r\n    #view-tab-preview:checked ~ .stageWrap .stage-preview {\r\n      display: block;\r\n    }\r\n\r\n    #view-tab-tileset:checked ~ .stageWrap .stage-tileset {\r\n      display: block;\r\n    }\r\n\r\n    #noise-canvas {\r\n      display: block;\r\n      width: 100%;\r\n      height: 100%;\r\n    }\r\n\r\n    /* Mosaic panel now lives inside the stage square */\r\n    #mosaic {\r\n      width: 100%;\r\n      height: 100%;\r\n      display: grid;\r\n      grid-template-columns: repeat(3, 1fr);\r\n      grid-template-rows: repeat(3, 1fr);\r\n      gap: 0;\r\n      padding: 0;\r\n      margin: 0;\r\n      line-height: 0;\r\n      font-size: 0;\r\n\r\n      border-radius: 0;\r\n      overflow: hidden;\r\n      border: 0;\r\n      background: #000;\r\n    }\r\n\r\n    #mosaic canvas {\r\n      display: block;\r\n      width: 100%;\r\n      height: 100%;\r\n      margin: 0;\r\n      padding: 0;\r\n      border: 0;\r\n      background: #000;\r\n    }\r\n\r\n    .stage-footer {\r\n      margin-top: -2px;\r\n      padding: 0 4px;\r\n    }\r\n\r\n    .mosaic-caption {\r\n      margin: 0;\r\n      font-size: 11px;\r\n      color: #aaaaaa;\r\n      line-height: 1.35;\r\n    }\r\n\r\n    #view-tab-preview:checked ~ .stage-footer {\r\n      display: none;\r\n    }\r\n\r\n    #view-tab-tileset:checked ~ .stage-footer {\r\n      display: block;\r\n    }\r\n\r\n    /* Export background toggles (near Save buttons) */\r\n    #export-bg {\r\n      margin: 2px 0 8px 0;\r\n      padding: 8px 10px;\r\n      border: 1px solid #262626;\r\n      border-radius: 999px;\r\n      background: rgba(12, 12, 12, 0.7);\r\n      display: flex;\r\n      align-items: center;\r\n      gap: 10px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    #export-bg .export-bg-title {\r\n      font-size: 0.78rem;\r\n      letter-spacing: 0.06em;\r\n      text-transform: uppercase;\r\n      color: #cfcfcf;\r\n      opacity: 0.9;\r\n    }\r\n\r\n    #export-bg label {\r\n      display: flex;\r\n      align-items: center;\r\n      gap: 6px;\r\n      margin: 0;\r\n      font-size: 0.82rem;\r\n      color: #e0e0e0;\r\n      cursor: pointer;\r\n      user-select: none;\r\n    }\r\n\r\n    #export-bg input[type="radio"] {\r\n      transform: translateY(1px);\r\n    }\r\n\r\n    /* Collapsible Param groups (details.param-group) */\r\n    aside#sidebar .param-group {\r\n      background: radial-gradient(\r\n        circle at top left,\r\n        #171717 0,\r\n        var(--panel-bg) 35%,\r\n        #020202 100%\r\n      );\r\n      border: 1px solid #262626;\r\n      border-radius: 8px;\r\n      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.5);\r\n      margin: 0 0 10px 0;\r\n      padding: 0;\r\n      overflow: hidden;\r\n    }\r\n\r\n    aside#sidebar .param-group:hover {\r\n      border-color: var(--accent);\r\n      box-shadow:\r\n        0 0 0 1px var(--accent-soft),\r\n        0 6px 18px rgba(0, 0, 0, 0.7);\r\n    }\r\n\r\n    aside#sidebar .param-group > summary {\r\n      cursor: pointer;\r\n      list-style: none;\r\n      padding: 10px 9px;\r\n      font-size: 0.75rem;\r\n      letter-spacing: 0.12em;\r\n      text-transform: uppercase;\r\n      color: #e0e0e0;\r\n      border-bottom: 1px solid #262626;\r\n      user-select: none;\r\n      display: flex;\r\n      align-items: center;\r\n      justify-content: space-between;\r\n      gap: 10px;\r\n    }\r\n\r\n    aside#sidebar .param-group > summary::-webkit-details-marker {\r\n      display: none;\r\n    }\r\n\r\n    aside#sidebar .param-group > summary::after {\r\n      content: "\u25BE";\r\n      font-size: 0.9rem;\r\n      opacity: 0.9;\r\n      transform: translateY(-1px);\r\n      transition: transform 0.12s ease;\r\n    }\r\n\r\n    aside#sidebar .param-group[open] > summary::after {\r\n      transform: rotate(180deg) translateY(1px);\r\n    }\r\n\r\n    aside#sidebar .param-group > .param-body {\r\n      padding: 10px 9px 10px 9px;\r\n    }\r\n\r\n    .noise-modes-row {\r\n      display: flex;\r\n      align-items: flex-start;\r\n      gap: 8px;\r\n      margin-bottom: 4px;\r\n    }\r\n\r\n    aside#sidebar .param-group .param-body > label:not(.grow) {\r\n      display: flex;\r\n      align-items: center;\r\n      justify-content: space-between;\r\n      gap: 8px;\r\n      margin: 5px 0;\r\n      font-size: 0.9rem;\r\n    }\r\n\r\n    aside#sidebar .param-group input[type="number"] {\r\n      width: 7.2em;\r\n      padding: 2px 4px;\r\n      border-radius: 4px;\r\n      border: 1px solid #444;\r\n      background: #0d0d0d;\r\n      color: #fff;\r\n      font-size: 0.9rem;\r\n      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);\r\n    }\r\n\r\n    aside#sidebar .param-group input[type="number"]:focus-visible {\r\n      outline: none;\r\n      border-color: var(--accent);\r\n      box-shadow: 0 0 0 1px var(--accent-soft);\r\n    }\r\n\r\n    aside#sidebar .param-group input[type="checkbox"] {\r\n      transform: translateY(1px);\r\n    }\r\n\r\n    aside#sidebar .param-group label.grow {\r\n      display: flex;\r\n      flex-direction: column;\r\n      align-items: flex-start;\r\n      gap: 6px;\r\n      margin: 4px 0 8px 0;\r\n      font-size: 0.9rem;\r\n      width: 100%;\r\n    }\r\n\r\n    /* Nested details inside param bodies */\r\n    aside#sidebar details:not(.param-group) {\r\n      width: 100%;\r\n    }\r\n\r\n    aside#sidebar details:not(.param-group) summary {\r\n      cursor: pointer;\r\n      font-weight: 600;\r\n      list-style: none;\r\n      padding: 4px 0;\r\n      font-size: 0.86rem;\r\n      color: #e4e4e4;\r\n    }\r\n\r\n    aside#sidebar details:not(.param-group) > div {\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 6px;\r\n      margin-top: 6px;\r\n      padding-left: 8px;\r\n      border-left: 2px solid #2b2b2b;\r\n      max-height: 240px;\r\n      overflow-y: auto;\r\n      overflow-x: hidden;\r\n      width: 100%;\r\n    }\r\n\r\n    aside#sidebar details:not(.param-group) label {\r\n      display: flex;\r\n      align-items: center;\r\n      justify-content: flex-start;\r\n      gap: 6px;\r\n      margin: 0;\r\n      white-space: normal;\r\n      overflow-wrap: anywhere;\r\n      font-size: 0.8rem;\r\n      color: #d5d5d5;\r\n    }\r\n\r\n    /* Buttons */\r\n    #download-main,\r\n    #download-tile,\r\n    #download-tileset,\r\n    #render-btn {\r\n      display: inline-block;\r\n      margin: 4px 0 12px 0;\r\n      padding: 8px 12px;\r\n      font-size: 0.92rem;\r\n      border: 1px solid var(--accent);\r\n      border-radius: 999px;\r\n      background: linear-gradient(135deg, #2575fc, #21c0ff);\r\n      cursor: pointer;\r\n      color: #000;\r\n      width: 100%;\r\n      font-weight: 600;\r\n      letter-spacing: 0.06em;\r\n      text-transform: uppercase;\r\n    }\r\n\r\n    #render-btn:hover {\r\n      filter: brightness(1.05);\r\n      box-shadow: 0 6px 18px rgba(37, 117, 252, 0.5);\r\n    }\r\n\r\n    #apply-res {\r\n      margin-top: 8px;\r\n      padding: 6px 10px;\r\n      font-size: 0.85rem;\r\n      border-radius: 999px;\r\n      border: 1px solid #666;\r\n      background: #e0e0e0;\r\n      cursor: pointer;\r\n      color: #000;\r\n      text-transform: uppercase;\r\n      letter-spacing: 0.08em;\r\n      width: 100%;\r\n    }\r\n\r\n    #apply-res:hover {\r\n      background: #d0d0d0;\r\n    }\r\n\r\n    aside#sidebar select {\r\n      padding: 2px 4px;\r\n      border-radius: 4px;\r\n      border: 1px solid #444;\r\n      background: #101010;\r\n      color: #fff;\r\n      font-size: 0.88rem;\r\n      width: 7.2em;\r\n    }\r\n\r\n    aside#sidebar input[type="range"] {\r\n      width: 100%;\r\n      appearance: none;\r\n      height: 4px;\r\n      border-radius: 999px;\r\n      background: linear-gradient(90deg, #333, #666);\r\n      outline: none;\r\n    }\r\n\r\n    aside#sidebar input[type="range"]::-webkit-slider-thumb {\r\n      appearance: none;\r\n      width: 12px;\r\n      height: 12px;\r\n      border-radius: 50%;\r\n      background: #ffffff;\r\n      border: 1px solid #111;\r\n      box-shadow: 0 0 0 3px var(--accent-soft);\r\n      cursor: pointer;\r\n    }\r\n\r\n    aside#sidebar input[type="range"]::-moz-range-thumb {\r\n      width: 12px;\r\n      height: 12px;\r\n      border-radius: 50%;\r\n      background: #ffffff;\r\n      border: 1px solid #111;\r\n      box-shadow: 0 0 0 3px var(--accent-soft);\r\n      cursor: pointer;\r\n    }\r\n\r\n    .grow {\r\n      flex: 1;\r\n      min-width: 0;\r\n    }\r\n\r\n    hr {\r\n      border: 0;\r\n      border-top: 1px solid #1f1f1f;\r\n      margin: 12px 0;\r\n      opacity: 0.9;\r\n    }\r\n\r\n    @media (max-height: 720px) {\r\n      .squareWrap {\r\n        width: min(\r\n          calc(100vw - var(--sidebar-w) - (var(--gap) * 4)),\r\n          calc(100dvh - (var(--gap) * 4))\r\n        );\r\n      }\r\n    }\r\n  </style>\r\n\r\n  <aside id="sidebar">\r\n    <div class="sidebar-header">\r\n      <div class="sidebar-title">WebGPU Noise Lab</div>\r\n      <div class="sidebar-subtitle">\r\n        Stack fields, slice 3D volumes, inspect tiling\r\n      </div>\r\n    </div>\r\n\r\n    <nav class="sidebar-nav">\r\n      <a href="#res-section" class="nav-pill">Resolution</a>\r\n      <a href="#noise-params" class="nav-pill">Noise</a>\r\n      <a href="#voro-params" class="nav-pill">Voronoi</a>\r\n      <a href="#adv-params" class="nav-pill">Advanced</a>\r\n      <a href="#overrides-group" class="nav-pill">Overrides</a>\r\n      <a href="#toroidal-section" class="nav-pill">Tileset</a>\r\n    </nav>\r\n\r\n    <details id="res-section" class="param-group">\r\n      <summary>Image Settings</summary>\r\n      <div class="param-body">\r\n        <label>\r\n          Canvas width:\r\n          <input type="number" id="res-width" value="800" min="1" />\r\n        </label>\r\n        <label>\r\n          Canvas height:\r\n          <input type="number" id="res-height" value="800" min="1" />\r\n        </label>\r\n        <button id="apply-res" type="button">Apply resolution</button>\r\n       \r\n        <label>\r\n          World Offset X (pixels):\r\n          <input type="number" id="res-offsetX" value="0" step="1" />\r\n        </label>\r\n        <label>\r\n          World Offset Y (pixels):\r\n          <input type="number" id="res-offsetY" value="0" step="1" />\r\n        </label>\r\n        <label>\r\n          World Offset Z (pixels):\r\n          <input type="number" id="res-offsetZ" value="0" step="1" />\r\n        </label>\r\n\r\n      </div>\r\n    </details>\r\n\r\n    <details id="noise-params" class="param-group" open>\r\n      <summary>Noise settings</summary>\r\n      <div class="param-body">\r\n        <div class="noise-modes-row">\r\n          <label class="grow">\r\n            Noise modes (additive):\r\n            <details class="grow">\r\n              <summary>Select noise types \u25BE</summary>\r\n              <div id="noise-type-list"></div>\r\n            </details>\r\n          </label>\r\n        </div>\r\n\r\n        <label>\r\n          Seed:\r\n          <input\r\n            type="number"\r\n            step="1"\r\n            id="noise-seed"\r\n            value="1234567892"\r\n            min="1"\r\n          />\r\n        </label>\r\n        <label>\r\n          Zoom:\r\n          <input type="number" step="0.1" id="noise-zoom" value="1.0" min="0.1" />\r\n        </label>\r\n        <label>\r\n          Frequency:\r\n          <input type="number" step="0.01" id="noise-freq" value="1.0" />\r\n        </label>\r\n        <label>\r\n          Octaves:\r\n          <input type="number" step="1" id="noise-octaves" value="8" min="1" />\r\n        </label>\r\n        <label>\r\n          Lacunarity:\r\n          <input\r\n            type="number"\r\n            step="0.1"\r\n            id="noise-lacunarity"\r\n            value="2.0"\r\n            min="0.1"\r\n          />\r\n        </label>\r\n        <label>\r\n          Gain:\r\n          <input\r\n            type="number"\r\n            step="0.01"\r\n            id="noise-gain"\r\n            value="0.5"\r\n            min="0.0"\r\n          />\r\n        </label>\r\n       \r\n        <label>\r\n          X step shift:\r\n          <input type="number" step="0.01" id="noise-xShift" value="0" />\r\n        </label>\r\n        <label>\r\n          Y step shift:\r\n          <input type="number" step="0.01" id="noise-yShift" value="0" />\r\n        </label>\r\n        <label>\r\n          Z step shift:\r\n          <input type="number" step="0.01" id="noise-zShift" value="0" />\r\n        </label>\r\n        \r\n      </div>\r\n    </details>\r\n\r\n    <details id="voro-params" class="param-group">\r\n      <summary>Voronoi</summary>\r\n      <div class="param-body">\r\n        <label>\r\n          Mode:\r\n          <select id="noise-voroMode" style="width: 100%">\r\n            <option value="0" selected>Granite (Cell value)</option>\r\n            <option value="5">Flat shade (Cells) [gap]</option>\r\n            <option value="6">Flat shade (Edges) [gap]</option>\r\n            <option value="4">Edge threshold (Gap gate) [gap]</option>\r\n            <option value="3">Edges (Continuous) [gap]</option>\r\n            <option value="2">Interior (F2 \u2212 F1) [gap]</option>\r\n\r\n            <option value="10">Flat shade (Cells) [sq]</option>\r\n            <option value="11">Flat shade (Edges) [sq]</option>\r\n            <option value="9">Edge threshold (Gap gate) [sq]</option>\r\n            <option value="8">Edges (Continuous) [sq]</option>\r\n            <option value="7">Interior (F2\xB2 \u2212 F1\xB2) [sq]</option>\r\n            <option value="1">F1 distance</option>\r\n            <option value="12">F1 threshold (Gate)</option>\r\n            <option value="13">F1 mask (Smooth)</option>\r\n            <option value="14">F1 mask (Smooth inv)</option>\r\n            <option value="15">Edge falloff (1 / (1 + gap*k))</option>\r\n            <option value="16">Edge falloff (1 / (1 + gapSq*k))</option>\r\n          </select>\r\n        </label>\r\n\r\n        <label>\r\n          Threshold:\r\n          <input type="number" step="0.01" id="noise-threshold" value="0.1" />\r\n        </label>\r\n\r\n        <label>\r\n          Edge softness (edgeK):\r\n          <input type="number" step="0.01" id="noise-edgeK" value="0.0" />\r\n        </label>\r\n      </div>\r\n    </details>\r\n\r\n    <details id="adv-params" class="param-group">\r\n      <summary>Advanced params</summary>\r\n      <div class="param-body">\r\n        <label>\r\n          Seed angle:\r\n          <input type="number" step="0.01" id="noise-seedAngle" value="0.0" />\r\n        </label>\r\n\r\n        <label>\r\n          Turbulence:\r\n          <input type="checkbox" id="noise-turbulence" />\r\n        </label>\r\n\r\n        <label>\r\n          Time:\r\n          <input type="number" step="0.01" id="noise-time" value="0.0" />\r\n        </label>\r\n\r\n        <label>\r\n          Warp amp:\r\n          <input type="number" step="0.01" id="noise-warpAmp" value="0.5" />\r\n        </label>\r\n\r\n        <label>\r\n          Gabor radius:\r\n          <input type="number" step="0.01" id="noise-gaborRadius" value="4.0" />\r\n        </label>\r\n\r\n        <label>\r\n          Terrace step:\r\n          <input type="number" step="0.01" id="noise-terraceStep" value="8.0" />\r\n        </label>\r\n\r\n        <label>\r\n          Exp1:\r\n          <input type="number" step="0.01" id="noise-exp1" value="1.0" />\r\n        </label>\r\n\r\n        <label>\r\n          Exp2:\r\n          <input type="number" step="0.01" id="noise-exp2" value="0.0" />\r\n        </label>\r\n\r\n        <label>\r\n          Ripple freq:\r\n          <input type="number" step="0.01" id="noise-rippleFreq" value="10.0" />\r\n        </label>\r\n      </div>\r\n    </details>\r\n\r\n    <details id="overrides-group" class="param-group">\r\n      <summary>Per entry overrides</summary>\r\n      <div class="param-body">\r\n        <label>\r\n          Entry:\r\n          <select id="override-mode" style="width: 100%"></select>\r\n        </label>\r\n\r\n        <label>\r\n          Zoom:\r\n          <input type="number" id="ov-zoom" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Frequency:\r\n          <input type="number" id="ov-freq" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Lacunarity:\r\n          <input type="number" id="ov-lacunarity" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Gain:\r\n          <input type="number" id="ov-gain" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Octaves:\r\n          <input type="number" id="ov-octaves" step="1" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Turbulence:\r\n          <select id="ov-turbulence" style="width: 7.2em">\r\n            <option value="">inherit</option>\r\n            <option value="0">0</option>\r\n            <option value="1">1</option>\r\n          </select>\r\n        </label>\r\n\r\n        <label>\r\n          Seed angle:\r\n          <input type="number" id="ov-seedAngle" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Exp1:\r\n          <input type="number" id="ov-exp1" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Exp2:\r\n          <input type="number" id="ov-exp2" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Ripple freq:\r\n          <input type="number" id="ov-rippleFreq" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Time:\r\n          <input type="number" id="ov-time" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Warp amp:\r\n          <input type="number" id="ov-warp" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Threshold:\r\n          <input type="number" id="ov-threshold" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Voronoi mode:\r\n          <select id="ov-voroMode" style="width: 7.2em">\r\n            <option value="">inherit</option>\r\n            <option value="0">granite</option>\r\n            <option value="5">flat cells</option>\r\n            <option value="6">flat edges</option>\r\n            <option value="4">edge gate</option>\r\n            <option value="3">edges</option>\r\n            <option value="1">f1</option>\r\n            <option value="2">gap</option>\r\n          </select>\r\n        </label>\r\n\r\n        <label>\r\n          EdgeK:\r\n          <input type="number" id="ov-edgeK" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Gabor radius:\r\n          <input type="number" id="ov-gabor" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          Terrace step:\r\n          <input type="number" id="ov-terraceStep" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <label>\r\n          X shift:\r\n          <input type="number" id="ov-xShift" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Y shift:\r\n          <input type="number" id="ov-yShift" step="0.01" placeholder="" />\r\n        </label>\r\n        <label>\r\n          Z shift:\r\n          <input type="number" id="ov-zShift" step="0.01" placeholder="" />\r\n        </label>\r\n\r\n        <button id="ov-clear" type="button" style="width: 100%; margin-top: 8px">\r\n          Clear overrides for entry\r\n        </button>\r\n      </div>\r\n    </details>\r\n    \r\n    <button id="render-btn" type="button">Render</button>\r\n\r\n    <div id="export-bg">\r\n      <div class="export-bg-title">Export BG</div>\r\n      <label>\r\n        <input\r\n          type="radio"\r\n          name="export-bg"\r\n          id="export-bg-transparent"\r\n          value="transparent"\r\n          checked\r\n        />\r\n        Transparent\r\n      </label>\r\n\r\n      <label>\r\n        <input\r\n          type="radio"\r\n          name="export-bg"\r\n          id="export-bg-black"\r\n          value="black"\r\n        />\r\n        Black\r\n      </label>\r\n\r\n      <label>\r\n        <input\r\n          type="radio"\r\n          name="export-bg"\r\n          id="export-bg-white"\r\n          value="white"\r\n        />\r\n        White\r\n      </label>\r\n    </div>\r\n\r\n    <button id="download-main" type="button">Save image</button>\r\n    <button id="download-tile" type="button">Save tile</button>\r\n    <button id="download-tileset" type="button">Save tileset</button>\r\n\r\n\r\n    <hr />\r\n\r\n    <details id="toroidal-section" class="param-group">\r\n      <summary>Tileset Controls</summary>\r\n      <div class="param-body">\r\n        <label class="grow">\r\n          Volume 4D modes (additive):\r\n          <details class="grow">\r\n            <summary>Select 4D types \u25BE</summary>\r\n            <div id="toroidal-type-list"></div>\r\n          </details>\r\n        </label>\r\n\r\n        <label>\r\n          Slice index:\r\n          <input type="number" id="z-slice-num" min="0" max="127" value="64" />\r\n        </label>\r\n      </div>\r\n    </details>\r\n  </aside>\r\n\r\n  <main id="main">\r\n    <div id="view-stack" class="content">\r\n      <div class="stage">\r\n        <input type="radio" name="view-tab" id="view-tab-preview" checked />\r\n        <input type="radio" name="view-tab" id="view-tab-tileset" />\r\n\r\n        <div class="preview-header">\r\n          <div id="preview-meta">Height field preview</div>\r\n          <div id="preview-stats"></div>\r\n        </div>\r\n\r\n        <div class="stage-tabs" role="tablist" aria-label="Preview tabs">\r\n          <label class="stage-tab" for="view-tab-preview">Main</label>\r\n          <label class="stage-tab" for="view-tab-tileset">Tileset</label>\r\n        </div>\r\n\r\n        <div class="squareWrap stageWrap">\r\n          <div class="stage-panel stage-preview">\r\n            <canvas id="noise-canvas"></canvas>\r\n          </div>\r\n\r\n          <div class="stage-panel stage-tileset">\r\n            \r\n        <label>\r\n          Z slice (0 to 127):\r\n          <input type="range" id="z-slice" min="0" max="127" value="64" />\r\n        </label>\r\n            <div id="mosaic"></div>\r\n          </div>\r\n        </div>\r\n\r\n        <div class="stage-footer">\r\n          <p id="mosaic-caption" class="mosaic-caption"></p>\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </main>\r\n</div>\r\n';var noiseCompute_default=`const PI : f32 = 3.141592653589793;
const TWO_PI : f32 = 6.283185307179586;

const ANGLE_INCREMENT : f32 = PI / 4.0;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 options UBO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
struct NoiseComputeOptions {
  getGradient : u32,
  useCustomPos : u32,
  outputChannel : u32,
  ioFlags : u32,
  baseRadius : f32,
  heightScale : f32,
  _pad1 : f32,
  _pad2 : f32,
};
@group(0) @binding(0) var<uniform> options : NoiseComputeOptions;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 params UBO (layout kept) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
struct NoiseParams {
  seed : u32,
  zoom : f32,
  freq : f32,
  octaves : u32,
  lacunarity : f32,
  gain : f32,
  xShift : f32,
  yShift : f32,
  zShift : f32,
  turbulence : u32,
  seedAngle : f32,
  exp1 : f32,
  exp2 : f32,
  threshold : f32,
  rippleFreq : f32,
  time : f32,
  warpAmp : f32,
  gaborRadius : f32,
  terraceStep : f32,
  toroidal : u32,
  voroMode : u32,
  edgeK:     f32
};
@group(0) @binding(1) var<uniform> params : NoiseParams;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 permutation table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
struct PermTable { values : array<u32, 512>, };
const PERM_SIZE : u32 = 512u;
const PERM_MASK : u32 = PERM_SIZE - 1u;
const INV_255 : f32 = 1.0 / 255.0;
const INV_2_OVER_255 : f32 = 2.0 / 255.0;

@group(0) @binding(2) var<storage, read> permTable : PermTable;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 IO resources \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@group(0) @binding(3) var inputTex : texture_2d_array<f32>;
@group(0) @binding(4) var outputTex : texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(5) var<storage, read> posBuf : array<vec4<f32>>;

struct Frame {
  fullWidth : u32,
  fullHeight : u32,
  tileWidth : u32,
  tileHeight : u32,

  originX : i32,
  originY : i32,
  originZ : i32,
  fullDepth : u32,

  tileDepth : u32,
  layerIndex : i32,
  layers : u32,
  _pad : u32,

  originXf : f32,
  originYf : f32,
  originZf : f32,
  _pad1    : f32,
};
@group(0) @binding(6) var<uniform> frame : Frame;

@group(0) @binding(7) var inputTex3D : texture_3d<f32>;
@group(0) @binding(8) var outputTex3D : texture_storage_3d<rgba16float, write>;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 small utilities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn clampZ(z: i32)->i32 {
  let depth = i32(max(u32(frame.fullDepth), 1u));
  return clamp(z, 0, depth - 1);
}
fn layerToZ(layerIndex:i32, layers:u32)->f32 {
  if (layers <= 1u) { return 0.0; }
  let li = max(layerIndex, 0);
  return f32(li) / f32(layers - 1u);
}
fn readFrom3D()->bool { return (options.ioFlags & 0x1u) != 0u; }
fn writeTo3D()->bool { return (options.ioFlags & 0x2u) != 0u; }

fn loadPrevRGBA(fx:i32, fy:i32, fz:i32)->vec4<f32> {
  if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(fx, fy, clampZ(fz)), 0); }
  return textureLoad(inputTex, vec2<i32>(fx, fy), frame.layerIndex, 0);
}
fn storeRGBA(fx:i32, fy:i32, fz:i32, col:vec4<f32>) {
  if (writeTo3D()) { textureStore(outputTex3D, vec3<i32>(fx, fy, clampZ(fz)), col); }
  else { textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, col); }
}

fn rotateXY3(p: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec3<f32>(
    p.x * c - p.y * s,
    p.x * s + p.y * c,
    p.z
  );
}


const STEREO_SCALE : f32 = 1.8;          // fixed packing scale for Clifford torus
const INV_SQRT2    : f32 = 0.7071067811865476; // 1/\u221A2

// add next to your other constants
const U_SCALE : f32 = 3.0;
const V_SCALE : f32 = 3.0;
const T_SCALE : f32 = 2.0;
const PACK_BIAS : vec4<f32> = vec4<f32>(0.37, 0.21, 0.29, 0.31);

fn packPeriodicUV(u: f32, v: f32, theta: f32) -> vec4<f32> {
  let aU = fract(u) * TWO_PI;
  let aV = fract(v) * TWO_PI;
  let aT = fract(theta) * TWO_PI;

  let x = cos(aU) * U_SCALE;
  let y = sin(aU) * U_SCALE;
  let z = cos(aV) * V_SCALE + cos(aT) * T_SCALE;
  let w = sin(aV) * V_SCALE + sin(aT) * T_SCALE;

  return vec4<f32>(x, y, z, w) + PACK_BIAS;
}


fn thetaFromDepth(fz: i32) -> f32 {
  let uses3D = writeTo3D() || readFrom3D();
  if (uses3D) {
    let d = max(f32(frame.fullDepth), 1.0);
    return (f32(clampZ(fz)) + 0.5) / d; // [0,1)
  }
  return layerToZ(frame.layerIndex, frame.layers);
}

fn seedOffset3(seed: u32) -> vec3<f32> {
  let a = f32((seed * 1664525u + 1013904223u) & 65535u) / 65536.0;
  let b = f32((seed * 22695477u + 1u) & 65535u) / 65536.0;
  let c = f32((seed * 1103515245u + 12345u) & 65535u) / 65536.0;

  return vec3<f32>(
    17.173 + a * 131.0,
    31.947 + b * 137.0,
    47.521 + c * 149.0
  );
}

fn fetchPos(fx: i32, fy: i32, fz: i32) -> vec3<f32> {
  if (options.useCustomPos == 1u) {
    let use3D = writeTo3D() || readFrom3D();
    let slice_i = select(frame.layerIndex, clampZ(fz), use3D);
    let slice = u32(max(slice_i, 0));
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);
    let idx = slice * frame.fullWidth * frame.fullHeight + u32(cy) * frame.fullWidth + u32(cx);
    return posBuf[idx].xyz;
  }

  if (params.toroidal == 1u) {
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);

    let invW = 1.0 / max(f32(frame.fullWidth), 1.0);
    let invH = 1.0 / max(f32(frame.fullHeight), 1.0);

    let U = (f32(cx) + 0.5) * invW;
    let V = (f32(cy) + 0.5) * invH;
    let theta = thetaFromDepth(fz);

    return vec3<f32>(U, V, theta);
  }

  let invW = 1.0 / max(f32(frame.fullWidth), 1.0);
  let invH = 1.0 / max(f32(frame.fullHeight), 1.0);

  var ox = frame.originXf;
  var oy = frame.originYf;
  if (ox == 0.0 && oy == 0.0) {
    ox = f32(frame.originX);
    oy = f32(frame.originY);
  }

  let x = (ox + f32(fx) + 0.5) * invW;
  let y = (oy + f32(fy) + 0.5) * invH;

  var z: f32;
  let uses3D = writeTo3D() || readFrom3D();
  if (uses3D) {
    if (frame.fullDepth <= 1u) {
      z = 0.0;
    } else {
      z = (f32(clampZ(fz)) + 0.5) / f32(frame.fullDepth);
    }
  } else {
    z = layerToZ(frame.layerIndex, frame.layers);
  }

  return vec3<f32>(x, y, z);
}



fn writeChannel(fx:i32, fy:i32, fz:i32, v0:f32, channel:u32, overwrite:u32) {
  let needsAccum = (overwrite == 0u);
  let writesAll = (channel == 0u);
  let skipRead = (!needsAccum) && (writesAll || channel == 5u);
  var inCol = vec4<f32>(0.0);
  if (!skipRead) { inCol = loadPrevRGBA(fx, fy, fz); }
  var outCol = inCol;

  if (channel == 0u)      { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol = vec4<f32>(h, h, h, h); }
  else if (channel == 1u) { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol.x = h; }
  else if (channel == 2u) { let h = select(v0 + inCol.y, v0, overwrite == 1u); outCol.y = h; }
  else if (channel == 3u) { let h = select(v0 + inCol.z, v0, overwrite == 1u); outCol.z = h; }
  else if (channel == 4u) { let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol.w = h; }
  else if (channel == 5u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, p.z, h); }
  else if (channel == 6u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, h, inCol.w); }

  storeRGBA(fx, fy, fz, outCol);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 math / noise bits \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/* gradient tables */
const GRAD2 : array<vec2<f32>, 8> = array<vec2<f32>, 8>(
  vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0,  1.0),
  vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0, -1.0),
  vec2<f32>( 1.0,  0.0), vec2<f32>(-1.0,  0.0),
  vec2<f32>( 0.0,  1.0), vec2<f32>( 0.0, -1.0)
);

const GRAD3 : array<vec3<f32>, 12> = array<vec3<f32>, 12>(
  vec3<f32>( 1.0,  1.0,  0.0), vec3<f32>(-1.0,  1.0,  0.0),
  vec3<f32>( 1.0, -1.0,  0.0), vec3<f32>(-1.0, -1.0,  0.0),
  vec3<f32>( 1.0,  0.0,  1.0), vec3<f32>(-1.0,  0.0,  1.0),
  vec3<f32>( 1.0,  0.0, -1.0), vec3<f32>(-1.0,  0.0, -1.0),
  vec3<f32>( 0.0,  1.0,  1.0), vec3<f32>( 0.0, -1.0,  1.0),
  vec3<f32>( 0.0,  1.0, -1.0), vec3<f32>( 0.0, -1.0, -1.0)
);
const GRAD4 : array<vec4<f32>, 32> = array<vec4<f32>, 32>(
  vec4<f32>( 0.0,  1.0,  1.0,  1.0), vec4<f32>( 0.0,  1.0,  1.0, -1.0),
  vec4<f32>( 0.0,  1.0, -1.0,  1.0), vec4<f32>( 0.0,  1.0, -1.0, -1.0),
  vec4<f32>( 0.0, -1.0,  1.0,  1.0), vec4<f32>( 0.0, -1.0,  1.0, -1.0),
  vec4<f32>( 0.0, -1.0, -1.0,  1.0), vec4<f32>( 0.0, -1.0, -1.0, -1.0),

  vec4<f32>( 1.0,  0.0,  1.0,  1.0), vec4<f32>( 1.0,  0.0,  1.0, -1.0),
  vec4<f32>( 1.0,  0.0, -1.0,  1.0), vec4<f32>( 1.0,  0.0, -1.0, -1.0),
  vec4<f32>(-1.0,  0.0,  1.0,  1.0), vec4<f32>(-1.0,  0.0,  1.0, -1.0),
  vec4<f32>(-1.0,  0.0, -1.0,  1.0), vec4<f32>(-1.0,  0.0, -1.0, -1.0),

  vec4<f32>( 1.0,  1.0,  0.0,  1.0), vec4<f32>( 1.0,  1.0,  0.0, -1.0),
  vec4<f32>( 1.0, -1.0,  0.0,  1.0), vec4<f32>( 1.0, -1.0,  0.0, -1.0),
  vec4<f32>(-1.0,  1.0,  0.0,  1.0), vec4<f32>(-1.0,  1.0,  0.0, -1.0),
  vec4<f32>(-1.0, -1.0,  0.0,  1.0), vec4<f32>(-1.0, -1.0,  0.0, -1.0),

  vec4<f32>( 1.0,  1.0,  1.0,  0.0), vec4<f32>( 1.0,  1.0, -1.0,  0.0),
  vec4<f32>( 1.0, -1.0,  1.0,  0.0), vec4<f32>( 1.0, -1.0, -1.0,  0.0),
  vec4<f32>(-1.0,  1.0,  1.0,  0.0), vec4<f32>(-1.0,  1.0, -1.0,  0.0),
  vec4<f32>(-1.0, -1.0,  1.0,  0.0), vec4<f32>(-1.0, -1.0, -1.0,  0.0)
);

/* Gradient accessors */
fn gradient(idx:u32)->vec3<f32> {
  return GRAD3[idx % 12u];
}
fn gradient2(idx:u32)->vec2<f32> {
  return GRAD2[idx % 8u];
}
fn gradient4(idx: u32) -> vec4<f32> {
  return GRAD4[idx % 32u];
}


fn fade(t:f32)->f32 { return t*t*t*(t*(t*6.0 - 15.0) + 10.0); }
fn lerp(a:f32, b:f32, t:f32)->f32 { return a + t * (b - a); }

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 perm/hash helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn perm(idx: u32) -> u32 {
  return permTable.values[idx & PERM_MASK];
}

fn rot3(p: vec3<f32>) -> vec3<f32> {
  let x = 0.00 * p.x + -0.80 * p.y + -0.60 * p.z;
  let y = 0.80 * p.x +  0.36 * p.y + -0.48 * p.z;
  let z = 0.60 * p.x + -0.48 * p.y +  0.64 * p.z;
  return vec3<f32>(x, y, z);
}

fn hash2(ix : i32, iy : i32) -> u32 {
  return perm((u32(ix) & PERM_MASK) + perm(u32(iy) & PERM_MASK)) & PERM_MASK;
}
fn rand2(ix : i32, iy : i32) -> f32 {
  let idx = hash2(ix, iy);
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;
}
fn rand2u(ix : i32, iy : i32) -> f32 {
  let idx = hash2(ix, iy);
  return f32(perm(idx)) * INV_255;
}

// 3D helpers
fn hash3(ix : i32, iy : i32, iz : i32) -> u32 {
  return perm((u32(ix) & PERM_MASK)
            + perm((u32(iy) & PERM_MASK) + perm(u32(iz) & PERM_MASK)))
         & PERM_MASK;
}
fn rand3(ix : i32, iy : i32, iz : i32) -> f32 {
  let idx = hash3(ix, iy, iz);
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;
}
fn rand3u(ix : i32, iy : i32, iz : i32) -> f32 {
  let idx = hash3(ix, iy, iz);
  return f32(perm(idx)) * INV_255;
}

// 4D helpers
fn hash4(ix : i32, iy : i32, iz : i32, iw : i32) -> u32 {
  let a = perm(u32(ix) & PERM_MASK);
  let b = perm((u32(iy) & PERM_MASK) + a);
  let c = perm((u32(iz) & PERM_MASK) + b);
  return perm((u32(iw) & PERM_MASK) + c) & PERM_MASK;
}
fn rand4(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {
  let idx = hash4(ix, iy, iz, iw);
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;
}
fn rand4u(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {
  let idx = hash4(ix, iy, iz, iw);
  return f32(perm(idx)) * INV_255;
}


/* ---------- classic 2D Perlin ---------- */
fn noise2D(p : vec2<f32>) -> f32 {
  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;

  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);

  let u = fade(xf);
  let v = fade(yf);

  let A  = perm(X) + Y;
  let B  = perm((X + 1u) & PERM_MASK) + Y;

  let gAA = gradient2(perm(A & PERM_MASK));
  let gBA = gradient2(perm(B & PERM_MASK));
  let gAB = gradient2(perm((A + 1u) & PERM_MASK));
  let gBB = gradient2(perm((B + 1u) & PERM_MASK));

  let x1 = lerp(dot(gAA, vec2<f32>(xf,       yf      )),
                dot(gBA, vec2<f32>(xf - 1.0, yf      )), u);
  let x2 = lerp(dot(gAB, vec2<f32>(xf,       yf - 1.0)),
                dot(gBB, vec2<f32>(xf - 1.0, yf - 1.0)), u);
  return lerp(x1, x2, v);
}

//matches 3d z=0 slice, less multiplying
fn noise2D_from_3D(p: vec3<f32>) -> f32 {
  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;

  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);
  let u = fade(xf);
  let v = fade(yf);

  // 3D hashing path with Z = 0
  let A  = perm(X) + Y;
  let AA = perm(A & PERM_MASK);                 // + Z(=0)
  let AB = perm((A + 1u) & PERM_MASK);          // + Z(=0)
  let B  = perm((X + 1u) & PERM_MASK) + Y;
  let BA = perm(B & PERM_MASK);                 // + Z(=0)
  let BB = perm((B + 1u) & PERM_MASK);          // + Z(=0)

  let gAA = gradient(perm(AA & PERM_MASK));
  let gBA = gradient(perm(BA & PERM_MASK));
  let gAB = gradient(perm(AB & PERM_MASK));
  let gBB = gradient(perm(BB & PERM_MASK));

  let n00 = dot(gAA, vec3<f32>(xf,       yf,       0.0));
  let n10 = dot(gBA, vec3<f32>(xf - 1.0, yf,       0.0));
  let n01 = dot(gAB, vec3<f32>(xf,       yf - 1.0, 0.0));
  let n11 = dot(gBB, vec3<f32>(xf - 1.0, yf - 1.0, 0.0));

  let nx0 = lerp(n00, n10, u);
  let nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v);
}

/* ---------- classic 3D Perlin ---------- */
fn noise3D(p: vec3<f32>) -> f32 {
  if (p.z == 0.0) { return noise2D_from_3D(p); }

  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let iz = i32(floor(p.z));
  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;
  let Z: u32 = u32(iz) & PERM_MASK;

  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);
  let zf = p.z - floor(p.z);

  let u = fade(xf);
  let v = fade(yf);
  let w = fade(zf);

  let A  = perm(X) + Y;
  let AA = perm(A & PERM_MASK) + Z;
  let AB = perm((A + 1u) & PERM_MASK) + Z;
  let B  = perm((X + 1u) & PERM_MASK) + Y;
  let BA = perm(B & PERM_MASK) + Z;
  let BB = perm((B + 1u) & PERM_MASK) + Z;

  let gAA  = gradient(perm(AA & PERM_MASK));
  let gBA  = gradient(perm(BA & PERM_MASK));
  let gAB  = gradient(perm(AB & PERM_MASK));
  let gBB  = gradient(perm(BB & PERM_MASK));
  let gAA1 = gradient(perm((AA + 1u) & PERM_MASK));
  let gBA1 = gradient(perm((BA + 1u) & PERM_MASK));
  let gAB1 = gradient(perm((AB + 1u) & PERM_MASK));
  let gBB1 = gradient(perm((BB + 1u) & PERM_MASK));

  let x1 = lerp(dot(gAA,  vec3<f32>(xf,       yf,       zf      )),
                dot(gBA,  vec3<f32>(xf - 1.0, yf,       zf      )), u);
  let x2 = lerp(dot(gAB,  vec3<f32>(xf,       yf - 1.0, zf      )),
                dot(gBB,  vec3<f32>(xf - 1.0, yf - 1.0, zf      )), u);
  let y1 = lerp(x1, x2, v);

  let x3 = lerp(dot(gAA1, vec3<f32>(xf,       yf,       zf - 1.0)),
                dot(gBA1, vec3<f32>(xf - 1.0, yf,       zf - 1.0)), u);
  let x4 = lerp(dot(gAB1, vec3<f32>(xf,       yf - 1.0, zf - 1.0)),
                dot(gBB1, vec3<f32>(xf - 1.0, yf - 1.0, zf - 1.0)), u);
  let y2 = lerp(x3, x4, v);

  return lerp(y1, y2, w);
}


/* ---------- 4D Perlin (hypercube corners, gradient-based) ---------- */
fn noise4D(p: vec4<f32>) -> f32 {
  // integer cell coords
  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let iz = i32(floor(p.z));
  let iw = i32(floor(p.w));

  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;
  let Z: u32 = u32(iz) & PERM_MASK;
  let W: u32 = u32(iw) & PERM_MASK;

  // fractional part
  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);
  let zf = p.z - floor(p.z);
  let wf = p.w - floor(p.w);

  let u = fade(xf);
  let v = fade(yf);
  let t = fade(zf);
  let s = fade(wf);

  // helper to get corner gradient and dot product
  // corner offsets are dx,dy,dz,dw in {0,1}
  // for fractional component, use (xf - dx) etc; for dw=1 use (wf - 1.0)
  // compute hash for corner using hash4(ix+dx, iy+dy, iz+dz, iw+dw)
  let d0000 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf,       yf,       zf,       wf      ));
  let d1000 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf,       wf      ));
  let d0100 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf,       wf      ));
  let d1100 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf      ));

  let d0010 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf,       yf,       zf - 1.0, wf      ));
  let d1010 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf      ));
  let d0110 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf      ));
  let d1110 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf      ));

  let d0001 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf,       yf,       zf,       wf - 1.0));
  let d1001 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf,       wf - 1.0));
  let d0101 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf,       wf - 1.0));
  let d1101 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf - 1.0));

  let d0011 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf,       yf,       zf - 1.0, wf - 1.0));
  let d1011 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf - 1.0));
  let d0111 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf - 1.0));
  let d1111 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf - 1.0));

  // interpolate along x -> y -> z for w=0 layer
  let x00 = lerp(d0000, d1000, u);
  let x10 = lerp(d0100, d1100, u);
  let y0  = lerp(x00, x10, v);

  let x01 = lerp(d0010, d1010, u);
  let x11 = lerp(d0110, d1110, u);
  let y1  = lerp(x01, x11, v);

  let zLayer0 = lerp(y0, y1, t);

  // interpolate for w=1 layer
  let x00w = lerp(d0001, d1001, u);
  let x10w = lerp(d0101, d1101, u);
  let y0w  = lerp(x00w, x10w, v);

  let x01w = lerp(d0011, d1011, u);
  let x11w = lerp(d0111, d1111, u);
  let y1w  = lerp(x01w, x11w, v);

  let zLayer1 = lerp(y0w, y1w, t);

  // final interp along w
  return lerp(zLayer0, zLayer1, s);
}

fn worley3D(p : vec3<f32>) -> f32 {
    let fx = i32(floor(p.x));
    let fy = i32(floor(p.y));
    let fz = i32(floor(p.z));
    var minD : f32 = 1e9;
    for (var dz = -1; dz <= 1; dz = dz + 1) {
      for (var dy = -1; dy <= 1; dy = dy + 1) {
        for (var dx = -1; dx <= 1; dx = dx + 1) {
          let xi = fx + dx;
          let yi = fy + dy;
          let zi = fz + dz;
          let px = f32(xi) + rand3u(xi, yi, zi);
          let py = f32(yi) + rand3u(yi, zi, xi);
          let pz = f32(zi) + rand3u(zi, xi, yi);
          let dxv = px - p.x;
          let dyv = py - p.y;
          let dzv = pz - p.z;
          let d2 = dxv*dxv + dyv*dyv + dzv*dzv;
          if (d2 < minD) { minD = d2; }
        }
      }
    }
    return sqrt(minD);
  
}


/* ---------- 4D Worley (cellular) ---------- */
// fn worley4D(p: vec4<f32>) -> f32 {
//   let fx = i32(floor(p.x));
//   let fy = i32(floor(p.y));
//   let fz = i32(floor(p.z));
//   let fw = i32(floor(p.w));

//   var minDistSq : f32 = 1e9;

//   // iterate neighbor cells in 4D (3^4 = 81)
//   for (var dw = -1; dw <= 1; dw = dw + 1) {
//     for (var dz = -1; dz <= 1; dz = dz + 1) {
//       for (var dy = -1; dy <= 1; dy = dy + 1) {
//         for (var dx = -1; dx <= 1; dx = dx + 1) {
//           let xi = fx + dx;
//           let yi = fy + dy;
//           let zi = fz + dz;
//           let wi = fw + dw;

//           // jitter within each cell using rotated rand4u calls to decorrelate axes
//           let rx = rand4u(xi, yi, zi, wi);
//           let ry = rand4u(yi, zi, wi, xi);
//           let rz = rand4u(zi, wi, xi, yi);
//           let rw = rand4u(wi, xi, yi, zi);

//           let px = f32(xi) + rx;
//           let py = f32(yi) + ry;
//           let pz = f32(zi) + rz;
//           let pw = f32(wi) + rw;

//           let dxv = px - p.x;
//           let dyv = py - p.y;
//           let dzv = pz - p.z;
//           let dwv = pw - p.w;
//           let d2 = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;
//           if (d2 < minDistSq) { minDistSq = d2; }
//         }
//       }
//     }
//   }

//   return sqrt(minDistSq);
// }


fn cellular3D(p : vec3<f32>) -> f32 {
    let fx = i32(floor(p.x));
    let fy = i32(floor(p.y));
    let fz = i32(floor(p.z));
    var d1 : f32 = 1e9; var d2 : f32 = 1e9;
    for (var dz = -1; dz <= 1; dz++) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;
          let px = f32(xi) + rand3u(xi, yi, zi);
          let py = f32(yi) + rand3u(yi, zi, xi);
          let pz = f32(zi) + rand3u(zi, xi, yi);
          let dd = (px - p.x)*(px - p.x) + (py - p.y)*(py - p.y) + (pz - p.z)*(pz - p.z);
          if (dd < d1) { d2 = d1; d1 = dd; }
          else if (dd < d2) { d2 = dd; }
        }
      }
    }
    return d2 - d1;
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2-D Simplex  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn simplex2D(p : vec2<f32>) -> f32 {
  let F2 : f32 = 0.3660254037844386;  // (\u221A3-1)/2
  let G2 : f32 = 0.2113248654051871;  // (3-\u221A3)/6

  // Skew to simplex grid
  let s  = (p.x + p.y) * F2;
  let i  = i32(floor(p.x + s));
  let j  = i32(floor(p.y + s));
  let t  = f32(i + j) * G2;

  let X0 = f32(i) - t;
  let Y0 = f32(j) - t;
  let x0 = p.x - X0;
  let y0 = p.y - Y0;

  // Simplex corner order
  var i1u : u32 = 0u;
  var j1u : u32 = 0u;
  if (x0 > y0) { i1u = 1u; } else { j1u = 1u; }

  // Offsets for remaining corners
  let x1 = x0 - f32(i1u) + G2;
  let y1 = y0 - f32(j1u) + G2;
  let x2 = x0 - 1.0 + 2.0 * G2;
  let y2 = y0 - 1.0 + 2.0 * G2;

  // Hashed gradients (mod 8 for 2D gradient table)
  let ii  = u32(i) & PERM_MASK;
  let jj  = u32(j) & PERM_MASK;
  let gi0 = perm(ii + perm(jj)) & 7u;
  let gi1 = perm(ii + i1u + perm((jj + j1u) & PERM_MASK)) & 7u;
  let gi2 = perm((ii + 1u) + perm((jj + 1u) & PERM_MASK)) & 7u;

  // Contributions from each corner
  var t0 = 0.5 - x0 * x0 - y0 * y0;
  var n0 : f32 = 0.0;
  if (t0 > 0.0) {
    t0 *= t0;
    n0 = t0 * t0 * dot(gradient2(gi0), vec2<f32>(x0, y0));
  }

  var t1 = 0.5 - x1 * x1 - y1 * y1;
  var n1 : f32 = 0.0;
  if (t1 > 0.0) {
    t1 *= t1;
    n1 = t1 * t1 * dot(gradient2(gi1), vec2<f32>(x1, y1));
  }

  var t2 = 0.5 - x2 * x2 - y2 * y2;
  var n2 : f32 = 0.0;
  if (t2 > 0.0) {
    t2 *= t2;
    n2 = t2 * t2 * dot(gradient2(gi2), vec2<f32>(x2, y2));
  }

  // Same scale used in the standard reference implementation
  return 70.0 * (n0 + n1 + n2);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 3-D Simplex Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Call it like: let v = simplex3D(vec3<f32>(x,y,z));

fn simplex3D(pos : vec3<f32>) -> f32 {
    // Skew/\u200Bunskew factors for 3D
    let F3 : f32 = 1.0 / 3.0;
    let G3 : f32 = 1.0 / 6.0;

    // Skew the input space to find the simplex cell
    let s  = (pos.x + pos.y + pos.z) * F3;
    let i_f = floor(pos.x + s);
    let j_f = floor(pos.y + s);
    let k_f = floor(pos.z + s);

    let i = i32(i_f);
    let j = i32(j_f);
    let k = i32(k_f);

    // Unskew back to (x,y,z) space
    let t0 = f32(i + j + k) * G3;
    let X0 = f32(i) - t0;
    let Y0 = f32(j) - t0;
    let Z0 = f32(k) - t0;

    var x0 = pos.x - X0;
    var y0 = pos.y - Y0;
    var z0 = pos.z - Z0;

    // Determine which simplex we are in
    var i1: i32; var j1: i32; var k1: i32;
    var i2: i32; var j2: i32; var k2: i32;
    if (x0 >= y0) {
        if (y0 >= z0) {
            // X Y Z
            i1 = 1; j1 = 0; k1 = 0;
            i2 = 1; j2 = 1; k2 = 0;
        } else if (x0 >= z0) {
            // X Z Y
            i1 = 1; j1 = 0; k1 = 0;
            i2 = 1; j2 = 0; k2 = 1;
        } else {
            // Z X Y
            i1 = 0; j1 = 0; k1 = 1;
            i2 = 1; j2 = 0; k2 = 1;
        }
    } else {
        if (y0 < z0) {
            // Z Y X
            i1 = 0; j1 = 0; k1 = 1;
            i2 = 0; j2 = 1; k2 = 1;
        } else if (x0 < z0) {
            // Y Z X
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 0; j2 = 1; k2 = 1;
        } else {
            // Y X Z
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 1; j2 = 1; k2 = 0;
        }
    }

    // Offsets for the other three corners
    let x1 = x0 - f32(i1) + G3;
    let y1 = y0 - f32(j1) + G3;
    let z1 = z0 - f32(k1) + G3;

    let x2 = x0 - f32(i2) + 2.0 * G3;
    let y2 = y0 - f32(j2) + 2.0 * G3;
    let z2 = z0 - f32(k2) + 2.0 * G3;

    let x3 = x0 - 1.0 + 3.0 * G3;
    let y3 = y0 - 1.0 + 3.0 * G3;
    let z3 = z0 - 1.0 + 3.0 * G3;

    // Hash the corner indices to get gradient indices
    let ii = u32(i) & PERM_MASK;
    let jj = u32(j) & PERM_MASK;
    let kk = u32(k) & PERM_MASK;

    let gi0 = perm(ii + perm(jj + perm(kk)))        % 12u;
    let gi1 = perm(ii + u32(i1) + perm((jj + u32(j1)) + perm((kk + u32(k1))))) % 12u;
    let gi2 = perm(ii + u32(i2) + perm((jj + u32(j2)) + perm((kk + u32(k2))))) % 12u;
    let gi3 = perm(ii + 1u      + perm((jj + 1u     ) + perm((kk + 1u     )))) % 12u;

    // Compute contributions from each corner
    var n0: f32;
    var t_0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t_0 < 0.0) {
        n0 = 0.0;
    } else {
        let t2 = t_0 * t_0;
        n0 = t2 * t2 * dot(gradient(gi0), vec3<f32>(x0, y0, z0));
    }

    var n1: f32;
    var t_1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t_1 < 0.0) {
        n1 = 0.0;
    } else {
        let t2 = t_1 * t_1;
        n1 = t2 * t2 * dot(gradient(gi1), vec3<f32>(x1, y1, z1));
    }

    var n2: f32;
    var t_2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t_2 < 0.0) {
        n2 = 0.0;
    } else {
        let t2 = t_2 * t_2;
        n2 = t2 * t2 * dot(gradient(gi2), vec3<f32>(x2, y2, z2));
    }

    var n3: f32;
    var t_3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t_3 < 0.0) {
        n3 = 0.0;
    } else {
        let t2 = t_3 * t_3;
        n3 = t2 * t2 * dot(gradient(gi3), vec3<f32>(x3, y3, z3));
    }

    // Final scale to match [-1,1]
    return 32.0 * (n0 + n1 + n2 + n3);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  helpers  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/

fn cubicInterpolate(p0 : f32, p1 : f32, p2 : f32, p3 : f32, t : f32) -> f32 {
    return p1 + 0.5 * t *
        (p2 - p0 + t *
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t *
        (3.0 * (p1 - p2) + p3 - p0)));
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn lanczos2D(pos : vec2<f32>) -> f32 {
    let ix  : i32 = i32(floor(pos.x));
    let iy  : i32 = i32(floor(pos.y));
    let dx  : f32 = pos.x - f32(ix);
    let dy  : f32 = pos.y - f32(iy);

    /* 4\xD74 neighbourhood hashed once \u2014 unrolled for speed */
    let n00 = rand2(ix - 1, iy - 1);
    let n10 = rand2(ix + 0, iy - 1);
    let n20 = rand2(ix + 1, iy - 1);
    let n30 = rand2(ix + 2, iy - 1);

    let n01 = rand2(ix - 1, iy + 0);
    let n11 = rand2(ix + 0, iy + 0);
    let n21 = rand2(ix + 1, iy + 0);
    let n31 = rand2(ix + 2, iy + 0);

    let n02 = rand2(ix - 1, iy + 1);
    let n12 = rand2(ix + 0, iy + 1);
    let n22 = rand2(ix + 1, iy + 1);
    let n32 = rand2(ix + 2, iy + 1);

    let n03 = rand2(ix - 1, iy + 2);
    let n13 = rand2(ix + 0, iy + 2);
    let n23 = rand2(ix + 1, iy + 2);
    let n33 = rand2(ix + 2, iy + 2);

    /* cubic along x (columns) */
    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);

    /* cubic along y (rows)  */
    return cubicInterpolate(col0, col1, col2, col3, dy);
}


/* helper to fetch one z-slice and cubic-interpolate along x/y */
fn slice(ix : i32, iy : i32, iz : i32, dx : f32, dy : f32) -> f32 {
    let n00 = rand3(ix - 1, iy - 1, iz);
    let n10 = rand3(ix + 0, iy - 1, iz);
    let n20 = rand3(ix + 1, iy - 1, iz);
    let n30 = rand3(ix + 2, iy - 1, iz);

    let n01 = rand3(ix - 1, iy + 0, iz);
    let n11 = rand3(ix + 0, iy + 0, iz);
    let n21 = rand3(ix + 1, iy + 0, iz);
    let n31 = rand3(ix + 2, iy + 0, iz);

    let n02 = rand3(ix - 1, iy + 1, iz);
    let n12 = rand3(ix + 0, iy + 1, iz);
    let n22 = rand3(ix + 1, iy + 1, iz);
    let n32 = rand3(ix + 2, iy + 1, iz);

    let n03 = rand3(ix - 1, iy + 2, iz);
    let n13 = rand3(ix + 0, iy + 2, iz);
    let n23 = rand3(ix + 1, iy + 2, iz);
    let n33 = rand3(ix + 2, iy + 2, iz);

    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);

    return cubicInterpolate(col0, col1, col2, col3, dy);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn lanczos3D(pos : vec3<f32>) -> f32 {
    let ix : i32 = i32(floor(pos.x));
    let iy : i32 = i32(floor(pos.y));
    let iz : i32 = i32(floor(pos.z));
    let dx : f32 = pos.x - f32(ix);
    let dy : f32 = pos.y - f32(iy);
    let dz : f32 = pos.z - f32(iz);

    /* 4\xD74\xD74 neighbourhood \u2014 fetch & interpolate on-the-fly */

    let row0 = slice(ix, iy, iz - 1, dx, dy);
    let row1 = slice(ix, iy, iz + 0, dx, dy);
    let row2 = slice(ix, iy, iz + 1, dx, dy);
    let row3 = slice(ix, iy, iz + 2, dx, dy);

    return cubicInterpolate(row0, row1, row2, row3, dz);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn voronoi2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist : f32 = 1e9;
    var minVal  : f32 = 0.0;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            let dist = (px - pos.x) * (px - pos.x) +
                       (py - pos.y) * (py - pos.y);

            if (dist < minDist) {
                minDist = dist;
                minVal  = rand2u(xi, yi);
            }
        }
    }
    return minVal;          // in [0,1]
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
// fn voronoi3D(pos : vec3<f32>) -> f32 {
//     let fx : i32 = i32(floor(pos.x));
//     let fy : i32 = i32(floor(pos.y));
//     let fz : i32 = i32(floor(pos.z));

//     var minDist : f32 = 1e9;
//     var minVal  : f32 = 0.0;

//     for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {
//         for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
//             for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
//                 let xi = fx + dx;
//                 let yi = fy + dy;
//                 let zi = fz + dz;

//                 let px = f32(xi) + rand3u(xi, yi, zi);
//                 let py = f32(yi) + rand3u(yi, zi, xi);
//                 let pz = f32(zi) + rand3u(zi, xi, yi);

//                 let dist = (px - pos.x) * (px - pos.x) +
//                            (py - pos.y) * (py - pos.y) +
//                            (pz - pos.z) * (pz - pos.z);

//                 if (dist < minDist) {
//                     minDist = dist;
//                     minVal  = rand3u(xi, yi, zi);
//                 }
//             }
//         }
//     }
//     return minVal;          // in [0,1]
// }



// ----------------- types & mode constants -----------------
struct Voro3DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };
struct Voro4DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };

// ----------------- voro_eval: pick output depending on mode -----------------


const VORO_CELL            : u32 = 0u;
const VORO_F1              : u32 = 1u;
const VORO_INTERIOR        : u32 = 2u;  // gap = F2 - F1
const VORO_EDGES           : u32 = 3u;  // scaled gap
const VORO_EDGE_THRESH     : u32 = 4u;  // gate gap >= threshold
const VORO_FLAT_SHADE      : u32 = 5u;  // interior = 1, edges = 0 (edges defined by gap < threshold)
const VORO_FLAT_SHADE_INV  : u32 = 6u;  // edges = 1, interior = 0 (gap < threshold)

// Added: "old cellular3D" compatible squared-gap modes (F2^2 - F1^2)
const VORO_INTERIOR_SQ        : u32 = 7u;  // gapSq = F2^2 - F1^2
const VORO_EDGES_SQ           : u32 = 8u;  // scaled gapSq
const VORO_EDGE_THRESH_SQ     : u32 = 9u;  // gate gapSq >= threshold
const VORO_FLAT_SHADE_SQ      : u32 = 10u; // interior = 1, edges = 0 (gapSq < threshold)
const VORO_FLAT_SHADE_INV_SQ  : u32 = 11u; // edges = 1, interior = 0 (gapSq < threshold)

// Added: F1 threshold and masks (useful for "radius" gates, bubble masks, etc.)
const VORO_F1_THRESH      : u32 = 12u; // gate F1 >= threshold, returns F1 * gate
const VORO_F1_MASK        : u32 = 13u; // smooth mask: 0 below threshold, 1 above (feather=edgeK)
const VORO_F1_MASK_INV    : u32 = 14u; // inverted mask: 1 below threshold, 0 above (feather=edgeK)

// Added: softer edge line response (no threshold needed)
const VORO_EDGE_RCP       : u32 = 15u; // 1 / (1 + gap*k)
const VORO_EDGE_RCP_SQ    : u32 = 16u; // 1 / (1 + gapSq*k)

fn voro_edge_dist(f1Sq: f32, f2Sq: f32) -> f32 {
  let f1 = sqrt(max(f1Sq, 0.0));
  let f2 = sqrt(max(f2Sq, 0.0));
  return max(f2 - f1, 0.0);
}

// edgeDist is gap (or gapSq for *_SQ modes)
// returns 1 near edges (small edgeDist), 0 in interior
fn voro_edge_mask(edgeDist: f32, threshold: f32, feather: f32) -> f32 {
  let t = max(threshold, 0.0);
  if (t <= 0.0) { return 0.0; }

  let f = max(feather, 0.0);
  if (f > 0.0) {
    return 1.0 - smoothstep(t, t + f, edgeDist);
  }
  return select(0.0, 1.0, edgeDist < t);
}

// returns 0 below threshold, 1 above (optionally smoothed)
fn voro_thresh_mask(v: f32, threshold: f32, feather: f32) -> f32 {
  let t = max(threshold, 0.0);
  if (t <= 0.0) { return 0.0; }

  let f = max(feather, 0.0);
  if (f > 0.0) {
    return smoothstep(t, t + f, v);
  }
  return select(0.0, 1.0, v >= t);
}

fn voro_eval3D_metrics(m: Voro3DMetrics, params: NoiseParams, freqOrScale: f32) -> f32 {
  return voro_eval(
    m.f1Sq,
    m.f2Sq,
    m.cellVal,
    params.voroMode,
    max(params.edgeK, 0.0),
    max(params.threshold, 0.0),
    freqOrScale
  );
}

fn voro_legacy_cell_or_eval3D(m: Voro3DMetrics, params: NoiseParams, freqOrScale: f32, legacyCellValue: f32) -> f32 {
  let modeValue = voro_eval3D_metrics(m, params, freqOrScale);
  return select(modeValue, legacyCellValue, params.voroMode == VORO_CELL);
}


// f1Sq/f2Sq are squared distances; cellVal in [0,1].
// edgeK is scale (edges modes) or feather (mask modes). freqOrScale unused.
fn voro_eval(
  f1Sq: f32,
  f2Sq: f32,
  cellVal: f32,
  mode: u32,
  edgeK: f32,
  threshold: f32,
  freqOrScale: f32
) -> f32 {
  let f1 = sqrt(max(f1Sq, 0.0));
  let f2 = sqrt(max(f2Sq, 0.0));
  let gap = max(f2 - f1, 0.0);

  let gapSq = max(f2Sq - f1Sq, 0.0);

  switch (mode) {
    case VORO_CELL: {
      return cellVal;
    }
    case VORO_F1: {
      return f1;
    }
    case VORO_INTERIOR: {
      return gap;
    }
    case VORO_EDGES: {
      let k = max(edgeK, 0.0);
      return clamp(gap * select(10.0, k, k > 0.0), 0.0, 1.0);
    }
    case VORO_EDGE_THRESH: {
      let t = max(threshold, 0.0);
      let gate = select(0.0, 1.0, gap >= t);
      return gap * gate;
    }
    case VORO_FLAT_SHADE: {
      let edge = voro_edge_mask(gap, threshold, edgeK);
      return 1.0 - edge;
    }
    case VORO_FLAT_SHADE_INV: {
      let edge = voro_edge_mask(gap, threshold, edgeK);
      return edge;
    }

    case VORO_INTERIOR_SQ: {
      return gapSq;
    }
    case VORO_EDGES_SQ: {
      let k = max(edgeK, 0.0);
      return clamp(gapSq * select(10.0, k, k > 0.0), 0.0, 1.0);
    }
    case VORO_EDGE_THRESH_SQ: {
      let t = max(threshold, 0.0);
      let gate = select(0.0, 1.0, gapSq >= t);
      return gapSq * gate;
    }
    case VORO_FLAT_SHADE_SQ: {
      let edge = voro_edge_mask(gapSq, threshold, edgeK);
      return 1.0 - edge;
    }
    case VORO_FLAT_SHADE_INV_SQ: {
      let edge = voro_edge_mask(gapSq, threshold, edgeK);
      return edge;
    }

    case VORO_F1_THRESH: {
      let t = max(threshold, 0.0);
      let gate = select(0.0, 1.0, f1 >= t);
      return f1 * gate;
    }
    case VORO_F1_MASK: {
      return voro_thresh_mask(f1, threshold, edgeK);
    }
    case VORO_F1_MASK_INV: {
      return 1.0 - voro_thresh_mask(f1, threshold, edgeK);
    }

    case VORO_EDGE_RCP: {
      let k = max(edgeK, 0.0);
      return 1.0 / (1.0 + gap * k*10);
    }
    case VORO_EDGE_RCP_SQ: {
      let k = max(edgeK, 0.0);
      return 1.0 / (1.0 + gapSq * k*10);
    }

    default: {
      return gap;
    }
  }
}

// ----------------- helpers: metrics -----------------
fn voro3D_metrics(pos: vec3<f32>) -> Voro3DMetrics {
  let fx = i32(floor(pos.x));
  let fy = i32(floor(pos.y));
  let fz = i32(floor(pos.z));

  var d1 : f32 = 1e9;
  var d2 : f32 = 1e9;
  var lab: f32 = 0.0;

  for (var dz = -1; dz <= 1; dz = dz + 1) {
    for (var dy = -1; dy <= 1; dy = dy + 1) {
      for (var dx = -1; dx <= 1; dx = dx + 1) {
        let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;

        let rx = rand3u(xi, yi, zi);
        let ry = rand3u(yi, zi, xi);
        let rz = rand3u(zi, xi, yi);

        let px = f32(xi) + rx;
        let py = f32(yi) + ry;
        let pz = f32(zi) + rz;

        let dxv = px - pos.x;
        let dyv = py - pos.y;
        let dzv = pz - pos.z;

        let d2c = dxv*dxv + dyv*dyv + dzv*dzv;

        if (d2c < d1) {
          d2 = d1;
          d1 = d2c;
          lab = rand3u(xi, yi, zi);
        } else if (d2c < d2) {
          d2 = d2c;
        }
      }
    }
  }
  return Voro3DMetrics(d1, d2, lab);
}

fn voro4D_metrics(p: vec4<f32>) -> Voro4DMetrics {
  let fx = i32(floor(p.x));
  let fy = i32(floor(p.y));
  let fz = i32(floor(p.z));
  let fw = i32(floor(p.w));

  var d1 : f32 = 1e9;
  var d2 : f32 = 1e9;
  var lab: f32 = 0.0;

  for (var dw = -1; dw <= 1; dw = dw + 1) {
    for (var dz = -1; dz <= 1; dz = dz + 1) {
      for (var dy = -1; dy <= 1; dy = dy + 1) {
        for (var dx = -1; dx <= 1; dx = dx + 1) {
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz; let wi = fw + dw;

          let rx = rand4u(xi, yi, zi, wi);
          let ry = rand4u(yi, zi, wi, xi);
          let rz = rand4u(zi, wi, xi, yi);
          let rw = rand4u(wi, xi, yi, zi);

          let px = f32(xi) + rx;
          let py = f32(yi) + ry;
          let pz = f32(zi) + rz;
          let pw = f32(wi) + rw;

          let dxv = px - p.x; let dyv = py - p.y;
          let dzv = pz - p.z; let dwv = pw - p.w;

          let d2c = dxv*dxv + dyv*dyv + dzv*dzv + dwv*dwv;

          if (d2c < d1) {
            d2 = d1;
            d1 = d2c;
            lab = rand4u(xi, yi, zi, wi);
          } else if (d2c < d2) {
            d2 = d2c;
          }
        }
      }
    }
  }
  return Voro4DMetrics(d1, d2, lab);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Cellular 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn cellular2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist1 : f32 = 1e9;
    var minDist2 : f32 = 1e9;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            /* feature point */
            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            /* squared distance */
            let d = (px - pos.x) * (px - pos.x)
                  + (py - pos.y) * (py - pos.y);

            /* keep two smallest distances */
            if (d < minDist1) {
                minDist2 = minDist1;
                minDist1 = d;
            } else if (d < minDist2) {
                minDist2 = d;
            }
        }
    }
    /* return difference of 1st and 2nd nearest feature distances */
    return minDist2 - minDist1;
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Worley 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn worley2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist : f32 = 1e9;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            /* feature point */
            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            /* squared distance */
            let d = (px - pos.x) * (px - pos.x)
                  + (py - pos.y) * (py - pos.y);

            if (d < minDist) {
                minDist = d;
            }
        }
    }

    return sqrt(minDist);    // Euclidean distance to nearest feature
}

/* central-diff gradient of scalar simplex */
fn gradSimplex2(q: vec2<f32>, eps: f32) -> vec2<f32> {
  let dx = (simplex2D(q + vec2<f32>(eps, 0.0)) - simplex2D(q - vec2<f32>(eps, 0.0))) / (2.0 * eps);
  let dy = (simplex2D(q + vec2<f32>(0.0, eps)) - simplex2D(q - vec2<f32>(0.0, eps))) / (2.0 * eps);
  return vec2<f32>(dx, dy);
}

/* single-octave curl = grad rotated 90\xB0 (\u2202N/\u2202y, -\u2202N/\u2202x) */
fn curl2_simplex2D(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {
  let zoom = max(p.zoom, 1e-6);
  let freq = max(p.freq, 1e-6);
  let base = pos / zoom + vec2<f32>(p.xShift, p.yShift);
  let q = base * freq;

  // choose \u03B5 ~ half a cycle of current scale to avoid lattice aliasing
  let cycles_per_world = max(freq / zoom, 1e-6);
  let eps = 0.5 / cycles_per_world;

  let g = gradSimplex2(q, eps * freq);
  return vec2<f32>(g.y, -g.x);
}

/* multi-octave curl: sum derivatives per octave (no sharp creases) */
fn curl2_simplexFBM(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {
  let zoom = max(p.zoom, 1e-6);
  var q      = pos / zoom + vec2<f32>(p.xShift, p.yShift);
  var freq   : f32 = max(p.freq, 1e-6);
  var amp    : f32 = 1.0;
  var angle  : f32 = p.seedAngle;
  var curl   : vec2<f32> = vec2<f32>(0.0);

  for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
    // \u03B5 scales with octave so the finite difference stays well-conditioned
    let cycles_per_world = max(freq / zoom, 1e-6);
    let eps = 0.5 / cycles_per_world;

    let g = gradSimplex2(q * freq, eps * freq);
    curl += vec2<f32>(g.y, -g.x) * amp;

    // next octave
    freq *= p.lacunarity;
    amp  *= p.gain;

    // decorrelate like your Perlin path (XY rotate + shift bleed into next)
    let cA = cos(angle);
    let sA = sin(angle);
    let nx = q.x * cA - q.y * sA;
    let ny = q.x * sA + q.y * cA;
    q = vec2<f32>(nx, ny) + vec2<f32>(p.xShift, p.yShift);
    angle += ANGLE_INCREMENT;
  }
  return curl;
}

/* map a non-negative magnitude to [-1,1] for your writeChannel convention */
fn mag_to_signed01(m: f32) -> f32 {
  return clamp(m, 0.0, 1.0) * 2.0 - 1.0;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn domainWarpFBM(p: vec3<f32>, params: NoiseParams,
                 warpAmp: f32, stages: u32) -> f32 {
    var q = p;
    for (var i: u32 = 0u; i < stages; i = i + 1u) {
        let w = fbm3D(q, params) * warpAmp;
        q = q + vec3<f32>(w, w, w);
    }
    return fbm3D(q, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 gabor utils \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const TAU : f32 = 6.283185307179586;

fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }

fn hash_u32(x: u32) -> u32 {
  var v = x;
  v = (v ^ 61u) ^ (v >> 16u);
  v = v + (v << 3u);
  v = v ^ (v >> 4u);
  v = v * 0x27d4eb2du;
  v = v ^ (v >> 15u);
  return v;
}

fn hash3_u32(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> u32 {
  let x = u32(ix) * 73856093u;
  let y = u32(iy) * 19349663u;
  let z = u32(iz) * 83492791u;
  return hash_u32(x ^ y ^ z ^ seed ^ salt);
}

fn rnd01(h: u32) -> f32 {
  return f32(h) * (1.0 / 4294967295.0);
}

fn rand3_01(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> f32 {
  return rnd01(hash3_u32(ix, iy, iz, seed, salt));
}

fn rand3_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {
  let a = rand3_01(ix, iy, iz, seed, salt + 0u);
  let b = rand3_01(ix, iy, iz, seed, salt + 1u);
  let c = rand3_01(ix, iy, iz, seed, salt + 2u);
  return vec3<f32>(a, b, c);
}

fn rand_unit_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {
  let u = rand3_01(ix, iy, iz, seed, salt + 0u);
  let v = rand3_01(ix, iy, iz, seed, salt + 1u);

  let z = 1.0 - 2.0 * u;
  let r = sqrt(max(0.0, 1.0 - z * z));
  let a = TAU * v;

  return vec3<f32>(r * cos(a), r * sin(a), z);
}

fn gabor_kernel3D(d: vec3<f32>, dir: vec3<f32>, waveFreq: f32, sigma: f32, phase: f32) -> f32 {
  let s  = max(0.0005, sigma);
  let g  = exp(-dot(d, d) / (2.0 * s * s));
  let w  = cos(TAU * waveFreq * dot(dir, d) + phase);
  return g * w;
}

fn gaborWarpDomain(p: vec3<f32>, params: NoiseParams) -> vec3<f32> {
  let a = params.warpAmp;
  if (a <= 0.00001) { return p; }

  let w1 = simplex3D(p * 0.75 + vec3<f32>(13.1, 7.7, 19.3));
  let w2 = simplex3D(p * 0.75 + vec3<f32>(41.7, 23.9, 5.3));
  let w3 = simplex3D(p * 0.75 + vec3<f32>(9.9, 31.3, 17.7));

  return p + vec3<f32>(w1, w2, w3) * a;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Gabor sparse-convolution  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn gaborOctave3D(p: vec3<f32>, waveFreq: f32, sigma: f32, params: NoiseParams) -> f32 {
  let base = vec3<i32>(
    i32(floor(p.x)),
    i32(floor(p.y)),
    i32(floor(p.z))
  );

  var sum: f32 = 0.0;

  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
        let cx = base.x + dx;
        let cy = base.y + dy;
        let cz = base.z + dz;

        let jitter = rand3_vec3(cx, cy, cz, params.seed, 11u) - vec3<f32>(0.5, 0.5, 0.5);
        let center = vec3<f32>(f32(cx), f32(cy), f32(cz)) + vec3<f32>(0.5, 0.5, 0.5) + jitter * 0.95;

        let d     = p - center;
        let dir   = rand_unit_vec3(cx, cy, cz, params.seed, 41u);
        let phase = TAU * rand3_01(cx, cy, cz, params.seed, 71u);
        let amp   = rand3_01(cx, cy, cz, params.seed, 91u) * 2.0 - 1.0;

        sum += amp * gabor_kernel3D(d, dir, waveFreq, sigma, phase);
      }
    }
  }

  return sum * (1.0 / 9.0);
}

fn gaborShape(n: f32, params: NoiseParams) -> f32 {
  var v = 0.5 + 0.5 * clamp(n, -1.0, 1.0);

  let widen = max(0.0, params.gaborRadius) * max(0.0001, params.exp2);
  v = pow(saturate(v), 1.0 / (1.0 + widen));

  let t    = saturate(params.threshold);
  let hard = max(0.0001, params.exp1);

  let a = smoothstep(t - hard, t + hard, v);
  return a * 2.0 - 1.0;
}

fn gaborCellEdgeMask2D(cellP: vec2<f32>, edgeK: f32) -> f32 {
  let k = max(0.0, edgeK);
  if (k <= 0.00001) { return 1.0; }

  let width = select(k, 0.5 / k, k > 0.5);
  let w = clamp(width, 0.00001, 0.5);

  let f  = fract(cellP);
  let dx = min(f.x, 1.0 - f.x);
  let dy = min(f.y, 1.0 - f.y);
  let d  = min(dx, dy);

  return smoothstep(0.0, w, d);
}

/* Multi-octave Gabor with per-octave cell-edge fade */
fn gaborNoise3D(p: vec3<f32>, params: NoiseParams) -> f32 {
  var x = p.x / params.zoom + params.xShift;
  var y = p.y / params.zoom + params.yShift;
  var z = p.z / params.zoom + params.zShift;

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  let waveFreq = max(0.001, params.rippleFreq);

  var minMask : f32 = 1.0;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let sigma = max(0.0005, params.gaborRadius);

    var pp = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);
    pp = gaborWarpDomain(pp, params);

    let edgeM = gaborCellEdgeMask2D(pp.xy, params.edgeK);
    minMask = min(minMask, edgeM);

    var n = gaborOctave3D(pp, waveFreq, sigma, params);

    if (params.turbulence == 1u) {
      n = abs(n) * edgeM;
    } else {
      n = (-1.0) + (n + 1.0) * edgeM;
    }

    sum += n * amp;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    let c  = cos(angle);
    let s  = sin(angle);
    let nx = x * c - y * s;
    let ny = x * s + y * c;
    let nz = y * s + z * c;

    x = nx + params.xShift;
    y = ny + params.yShift;
    z = nz + params.zShift;

    angle += ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) {
    sum = mix(-1.0, sum, minMask);
  }

  var out = gaborShape(sum, params);
  if (params.turbulence == 1u) { out = out - 1.0; }
  return out;
}

fn gaborFlowKernel3D(r: vec3<f32>, d: vec2<f32>, ex: f32, ey: f32, ez: f32, c: f32, phase: f32) -> f32 {
  let rx = dot(r.xy, d);
  let ry = dot(r.xy, vec2<f32>(d.y, -d.x));
  let g  = exp(ex * rx * rx + ey * ry * ry + ez * r.z * r.z);
  let w  = cos(c * rx + phase);
  return g * w;
}

fn gaborMagicNoise3D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let sizeF = select(12.0, par.terraceStep, par.terraceStep > 0.00001);
  let size  = max(1, i32(clamp(sizeF, 1.0, 48.0) + 0.5));

  let zRad  = i32(2u);

  let sig = max(0.0005, par.gaborRadius);
  let gam = max(0.0001, par.exp2);

  let sx = sig;
  let sy = sig / gam;
  let sz = sig;

  let ex = -0.5 / (sx * sx);
  let ey = -0.5 / (sy * sy);
  let ez = -0.5 / (sz * sz);

  let lam = max(0.001, par.rippleFreq);
  let c   = TAU / lam;

  let P = 0.1963495408; // PI/16

  var cs: array<vec2<f32>, 16>;
  var ph: array<f32, 16>;
  var acc: array<f32, 16>;

  for (var k: u32 = 0u; k < 16u; k = k + 1u) {
    acc[k] = 0.0;
    let a = f32(k) * P;
    cs[k] = vec2<f32>(cos(a), sin(a));
    ph[k] = TAU * rand3_01(i32(k), 0, 0, par.seed, 71u);
  }

  let base = vec3<f32>(
    p.x / par.zoom + par.xShift,
    p.y / par.zoom + par.yShift,
    p.z / par.zoom + par.zShift
  );

  let adv = vec3<f32>(par.time * 10.0, par.time * 10.0, par.time * 3.0);

  let seedOff = vec3<f32>(
    f32(par.seed & 1023u) * 23.17,
    f32((par.seed >> 10u) & 1023u) * 19.73,
    f32((par.seed >> 20u) & 1023u) * 17.11
  );

  let fscale = 0.1 * max(0.0001, par.freq);

  let phaseT = TAU * (par.time / lam);

  for (var dz: i32 = -zRad; dz <= zRad; dz = dz + 1) {
    for (var j: i32 = -size; j <= size; j = j + 1) {
      for (var i: i32 = -size; i <= size; i = i + 1) {
        let r = vec3<f32>(f32(i), f32(j), f32(dz));

        var sp = (base + r + adv + seedOff) * fscale;
        sp = gaborWarpDomain(sp, par);

        let src = 0.6 * (0.5 + 0.5 * noise3D(sp));

        for (var k: u32 = 0u; k < 16u; k = k + 1u) {
          acc[k] += src * gaborFlowKernel3D(r, cs[k], ex, ey, ez, c, ph[k] + phaseT);
        }
      }
    }
  }

  var mx: f32 = 0.0;
  for (var k: u32 = 0u; k < 16u; k = k + 1u) {
    mx = max(mx, acc[k]);
  }

  var v01 = saturate((mx / 10.0) * max(0.0001, par.gain));

  if (par.threshold > 0.00001) {
    let t    = saturate(par.threshold);
    let hard = max(0.0001, par.exp1);
    v01 = smoothstep(t - hard, t + hard, v01);
  }

  return v01 * 2.0 - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 flow-gabor helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

fn hash2f01(p: vec2<f32>, seed: u32) -> f32 {
  let h = sin(dot(p, vec2<f32>(12.9898, 78.233)) + f32(seed) * 0.000123);
  return fract(h * 43758.5453);
}

fn mnoise3D(p: vec3<f32>, mode: u32) -> f32 {
  let n = noise3D(p); // ~[-1,1]
  if (mode == 1u) { return -1.0 + 2.0 * abs(n); }          // cloud-like
  if (mode == 2u) { return -1.0 + 2.0 * (1.0 - abs(n)); }  // flame-like
  return n;
}

fn turb2D(U: vec2<f32>, t: f32, par: NoiseParams) -> f32 {
  var u = U;
  var tt = t;

  var f: f32 = 0.0;
  var q: f32 = 1.0;
  var s: f32 = 0.0;

  let m: f32 = 2.0;
  let iters: u32 = clamp(par.octaves, 1u, 4u);

  for (var i: u32 = 0u; i < 4u; i = i + 1u) {
    if (i >= iters) { break; }

    u -= tt * vec2<f32>(0.6, 0.2);
    f += q * mnoise3D(vec3<f32>(u, tt), par.voroMode);
    s += q;

    q *= 0.5;
    u *= m;
    tt *= 1.71;
  }

  return f / max(1e-6, s);
}

fn flowDir2D(U: vec2<f32>, t: f32, par: NoiseParams) -> vec2<f32> {
  let eps: f32 = 1e-3;
  let S: f32 = max(1e-4, par.freq);

  let a = turb2D(S * (U + vec2<f32>(0.0, -eps)), t, par);
  let b = turb2D(S * (U + vec2<f32>(0.0,  eps)), t, par);
  let c = turb2D(S * (U + vec2<f32>( eps, 0.0)), t, par);
  let d = turb2D(S * (U + vec2<f32>(-eps, 0.0)), t, par);

  var V = vec2<f32>((a - b), (c - d)) / eps;

  let l2 = dot(V, V);
  if (l2 < 1e-20) { V = vec2<f32>(1.0, 0.0); }
  else { V *= inverseSqrt(l2); }

  // optional: rotate into "normal field" (like the shadertoy toggle)
  if ((par.voroMode & 4u) != 0u) { V = vec2<f32>(-V.y, V.x); }

  return V;
}

fn gaborPhasorFlow(U: vec2<f32>, V: vec2<f32>, par: NoiseParams) -> vec2<f32> {
  let F: f32 = max(1e-4, par.rippleFreq);

  let Wf = select(12.0, par.terraceStep, par.terraceStep > 0.00001);
  let W  = max(1, i32(clamp(Wf, 1.0, 24.0) + 0.5));

  let TG: f32 = par.time * 0.5 * max(0.0, par.warpAmp);

  var s: vec2<f32> = vec2<f32>(0.0);
  var T: f32 = 0.0;

  for (var j: i32 = -W; j <= W; j = j + 1) {
    for (var i: i32 = -W; i <= W; i = i + 1) {
      let P = vec2<f32>(f32(i), f32(j));

      let h = hash2f01(U + P, par.seed);
      let ang = TWO_PI * h - F * dot(P, V) + TG;

      let v = vec2<f32>(cos(ang), sin(ang));

      let d = min(1.0, length(P) / f32(W));
      let K = 0.5 + 0.5 * cos(PI * d); // raised-cosine kernel

      s += v * K;
      T += K;
    }
  }

  return s / max(1e-6, T);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

fn generateGaborFlow(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let zoom = max(par.zoom, 1e-6);

  // reconstruct pixel-ish domain like shadertoy (centered)
  let R = vec2<f32>(max(f32(frame.fullWidth), 1.0), max(f32(frame.fullHeight), 1.0));
  let uPix = vec2<f32>(pos.x * R.x, pos.y * R.y);
  let Uflow = (uPix - 0.5 * R) / R.y;

  // animated flow time
  let t = par.time * 0.2;

  // flow direction
  let V = flowDir2D(Uflow * (1.0 / zoom), t, par);

  // gabor phasor (use centered pixel coords like the reference)
  let s = gaborPhasorFlow((uPix - 0.5 * R) / zoom, V, par);

  // output mode:
  //  - turbulence==0: phasor profile (0..1)
  //  - turbulence==1: contrast (magnitude)
  let l = length(s);
  var v01: f32;

  if (par.turbulence == 1u) {
    v01 = saturate(4.0 * l * max(0.0001, par.gain));
  } else {
    let nx = select(1.0, s.x / l, l > 1e-8);
    v01 = 0.5 + 0.5 * nx;
    v01 = saturate(v01 * max(0.0001, par.gain));
  }

  if (par.threshold > 0.00001) {
    let tt = saturate(par.threshold);
    let hard = max(0.0001, par.exp1);
    v01 = smoothstep(tt - hard, tt + hard, v01);
  }

  return v01 * 2.0 - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 compute entry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

@compute @workgroup_size(8,8,1)
fn computeGaborFlow(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateGaborFlow(p, params), options.outputChannel, 0u);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Terrace & Foam filters  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn terrace(v:f32, steps:f32)  -> f32 { return floor(v*steps)/steps; }
fn foamify(v: f32) -> f32 {
    let x = clamp(v, 0.0, 1.0);

    let lo = smoothstep(0.18, 0.48, x);
    let hi = 1.0 - smoothstep(0.58, 0.92, x);

    let band = clamp(lo * hi, 0.0, 1.0);
    return pow(band, 0.6);
}
fn turbulence(v:f32)          -> f32 { return abs(v); }

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Simplex (multi-octave) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn generateSimplex(pos: vec3<f32>, p: NoiseParams) -> f32 {
    let invZoom = 1.0 / max(p.zoom, 1e-6);
    let domainOffset = seedOffset3(p.seed);

    let base = vec3<f32>(
      pos.x * invZoom + p.xShift,
      pos.y * invZoom + p.yShift,
      pos.z * invZoom + p.zShift
    ) + domainOffset;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var ampSum  : f32 = 0.0;
    var freqLoc : f32 = max(p.freq, 1e-6);
    var angle   : f32 = p.seedAngle;

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        let samplePos = rotateXY3(base, angle) * freqLoc;
        var n = simplex3D(samplePos);
        if (p.turbulence == 1u) { n = abs(n); }
        sum += n * amp;
        ampSum += amp;

        freqLoc *= p.lacunarity;
        amp     *= p.gain;
        angle   += ANGLE_INCREMENT;
    }

    if (ampSum > 0.0) {
        sum = sum / ampSum;
    }
    if (p.turbulence == 1u) { sum = sum * 2.0 - 1.0; }
    return sum;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex-based fBm helper (normalized)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn sfbm3D(pos : vec3<f32>, params: NoiseParams) -> f32 {
    let invZoom = 1.0 / max(params.zoom, 1e-6);
    let domainOffset = seedOffset3(params.seed);

    let base = vec3<f32>(
      pos.x * invZoom + params.xShift,
      pos.y * invZoom + params.yShift,
      pos.z * invZoom + params.zShift
    ) + domainOffset;

    var sum       : f32 = 0.0;
    var amplitude : f32 = 1.0;
    var maxValue  : f32 = 0.0;
    var freqLoc   : f32 = max(params.freq, 1e-6);
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = rotateXY3(base, angle) * freqLoc;
        var n = simplex3D(samplePos);
        if (params.turbulence == 1u) { n = abs(n); }

        sum      += amplitude * n;
        maxValue += amplitude;

        freqLoc   *= params.lacunarity;
        amplitude *= params.gain;
        angle     += angleInc;
    }

    if (maxValue > 0.0) {
        var out = sum / maxValue;
        if (params.turbulence == 1u) {
            out = out * 2.0 - 1.0;
        }
        return out;
    }
    return 0.0;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex FBM (Perlin-style nested fBm)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn generateSimplexFBM(pos: vec3<f32>, p: NoiseParams) -> f32 {
    // Same  you use for Perlin FBM: fBm once, then feed through again
    let fbm1 = sfbm3D(pos, p);
    let fbm2 = sfbm3D(vec3<f32>(fbm1, fbm1, fbm1), p);
    return 2.0 * fbm2;  // keep roughly in [-1,1]
}

fn generateDomainWarpFBM1(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = domainWarpFBM(pos, par, par.warpAmp, 1u);
    return v;
}

fn generateDomainWarpFBM2(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = domainWarpFBM(pos, par, par.warpAmp, 2u);
    return v;
}

fn generateGaborAniso(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = gaborNoise3D(pos, par);
    return v;
}

fn generateGaborMagic(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return gaborMagicNoise3D(pos, par);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Perlin Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generatePerlin(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let invZoom = 1.0 / max(params.zoom, 1e-6);
  let domainOffset = seedOffset3(params.seed);

  let base = vec3<f32>(
    pos.x * invZoom + params.xShift,
    pos.y * invZoom + params.yShift,
    pos.z * invZoom + params.zShift
  ) + domainOffset;

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var freqLoc: f32 = max(params.freq, 1e-6);
  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let samplePos = rotateXY3(base, angle) * freqLoc;

    var n: f32 = noise3D(samplePos);
    if (params.turbulence == 1u) {
      n = abs(n);
    }

    sum += n * amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;
    angle += ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) {
    sum = sum - 1.0;
  }

  return sum;
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Perlin FBM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generatePerlin4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    var n = noise4D(base * freqLoc) * amp;
    if (params.turbulence == 1u) { n = abs(n); }
    sum += n;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>( base.x * c - base.y * s, base.x * s + base.y * c );
      let zw = vec2<f32>( base.z * c - base.w * s, base.z * s + base.w * c );
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (params.turbulence == 1u) { sum -= 1.0; }
  return sum;
}


fn generateTerraceNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generatePerlin(pos, par);
    let v = terrace(base, par.terraceStep);
    return v;
}

fn generateFoamNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generateBillow(pos, par);
    let v = foamify(base);
    return v;
}

fn generateTurbulence(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generatePerlin(pos, par);
    let v = turbulence(base);
    return v;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var p = pos / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);

    var sum: f32     = 0.0;
    var amp: f32     = 1.0;
    var freqLoc: f32 = max(params.freq, 1e-6);
    var ampSum: f32  = 0.0;
    var angle: f32   = params.seedAngle;

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let n  = noise3D(p * freqLoc);
        let b  = pow(abs(n), 0.75);
        sum    = sum + b * amp;
        ampSum = ampSum + amp;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        let c  = cos(angle);
        let s  = sin(angle);
        let xy = vec2<f32>(p.x, p.y);
        let r  = vec2<f32>(xy.x * c - xy.y * s, xy.x * s + xy.y * c);
        p = vec3<f32>(r.x, r.y, p.z + 0.03125);

        angle = angle + ANGLE_INCREMENT;
    }

    if (ampSum > 0.0) {
        sum = sum / ampSum;
    }

    let k: f32 = 1.2;
    let cMid   = sum - 0.5;
    let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));

    return clamp(shaped, 0.0, 1.0);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti-Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {
    return 1.0 - generateBillow(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// basic ridge transform of gradient noise
fn ridgeNoise(pos : vec3<f32>) -> f32 {
    let v = noise3D(pos);
    let w = 1.0 - abs(v);
    return w * w;
}

// octave\u2010sum generator using ridge noise
// sample like: let r = generateRidge(vec3<f32>(x,y,z));
fn generateRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + ridgeNoise(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;
        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }

    sum = sum - 1.0;
    return -sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// identical ridge transform, but flips sign at output
fn generateAntiRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // reuse generateRidge and negate its result
    return -generateRidge(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise (Fast Lanczos) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var freqLoc : f32 = max(params.freq, 1e-6);

    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
    var amp : f32 = 1.0;

    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        freqLoc = freqLoc * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }

    return sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 2 (Fast Lanczos + Rotation) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = (pos.x + params.xShift) / zoom;
    var y = (pos.y + params.yShift) / zoom;
    var z = (pos.z + params.zShift) / zoom;

    var freqLoc : f32 = max(params.freq, 1e-6);
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
    var amp : f32 = 1.0;
    var angle : f32 = params.seedAngle;

    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        freqLoc = freqLoc * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        let c = cos(angle);
        let s = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = z;

        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    return sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = (pos.x + params.xShift) / zoom;
    var y = (pos.y + params.yShift) / zoom;
    var z = (pos.z + params.zShift) / zoom;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        n = max(1e-7, n + 1.0);
        n = 2.0 * pow(n * 0.5, params.exp2 + 1.5) - 1.0;
        n = 1.0 - abs(n);
        if (params.exp1 - 1.0 != 0.0) {
            n = 1.0 - pow(n, params.exp1 - 1.0);
        }

        sum = sum + n * amp;

        freqLoc = freqLoc * params.lacunarity;
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
        amp = amp * params.gain;
    }

    return sum - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = (pos.x + params.xShift) / zoom;
    var y = (pos.y + params.yShift) / zoom;
    var z = (pos.z + params.zShift) / zoom;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum + n * amp;

        freqLoc = freqLoc * params.lacunarity;
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
        amp = amp * params.gain;
    }

    return 1.0 - sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal2(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal3(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal4(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fractal Brownian Motion (3D Simplex) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

// 3-D FBM helper: sums octaves of simplex noise with rotating shifts
fn fbm3D(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // apply zoom
    var x       = (pos.x + params.xShift) / params.zoom;
    var y       = (pos.y + params.yShift) / params.zoom;
    var z       = (pos.z + params.zShift) / params.zoom;
    var sum       : f32 = 0.0;
    var amplitude : f32 = 1.0;
    var maxValue  : f32 = 0.0;
    var freqLoc   : f32 = max(params.freq, 1e-6);
    // start angle from uniform seedAngle
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        // accumulate weighted noise
        sum = sum + amplitude * simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        maxValue = maxValue + amplitude;

        // next freq & amp
        freqLoc   = freqLoc * params.lacunarity;
        amplitude = amplitude * params.gain;

        // advance rotation
        angle = angle + angleInc;
        let offX = params.xShift * cos(angle);
        let offY = params.yShift * cos(angle);
        let offZ = params.zShift * cos(angle);

        // apply shift
        x = x + offX;
        y = y + offY;
        z = z + offZ;
    }
    // normalize
    return sum / maxValue;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// two\u2010stage fbm, then doubled
fn generateFBM(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let fbm2 = fbm3D(vec3<f32>(fbm1, fbm1, fbm1), params);
    return 2.0 * fbm2;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// chained fbm with scaling by zoom
fn generateFBM2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let s    = params.zoom;
    let fbm2 = fbm3D(vec3<f32>(fbm1 * s, fbm1 * s, fbm1 * s), params);
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,
                               pos.y + fbm2 * s,
                               pos.z + fbm2 * s), params);
    return 2.0 * fbm3;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// three\u2010step chaining of fbm with offset
fn generateFBM3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let s    = params.zoom;
    let fbm2 = fbm3D(vec3<f32>(pos.x + fbm1 * s,
                               pos.y + fbm1 * s,
                               pos.z + fbm1 * s), params);
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,
                               pos.y + fbm2 * s,
                               pos.z + fbm2 * s), params);
    return 2.0 * fbm3;
}

/*==============================================================================
  Cellular Brownian-Motion FBM helpers & generators
==============================================================================*/

fn edgeCut(val: f32, threshold: f32) -> f32 {
  // return 0.0 when val < threshold, otherwise return val
  return select(val, 0.0, val < threshold);
}

// 3-D Cellular FBM helper: sums octaves of cellular3D with rotating shifts
fn fbmCellular3D(pos : vec3<f32>, params : NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom;
    var y = (pos.y + params.yShift) / params.zoom;
    var z = (pos.z + params.zShift) / params.zoom;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    var angle   : f32 = params.seedAngle;
    let angleInc: f32 = 2.0 * PI / f32(params.octaves);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        let n = edgeCut(cellular3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)),
                        params.threshold);
        sum = sum + amp * n;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        angle = angle + angleInc;
        let offX = params.xShift * cos(angle);
        let offY = params.yShift * cos(angle);
        let offZ = params.zShift * cos(angle);

        x = x + offX;
        y = y + offY;
        z = z + offZ;
    }
    return sum;
}

/* ---- Three cellular FBM flavours ---------------------------------------- */
fn generateCellularBM1(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);
    return 1.5 * f2 - 1.0;
}

fn generateCellularBM2(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);
    return 1.5 * f3 - 1.0;
}

fn generateCellularBM3(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(pos + f1 * params.zoom), params);
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);
    return 1.5 * f3 - 1.0;
}

/* ---- Voronoi and Voronoi Brownian-Motion flavours ---------------------------------- */

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Voronoi Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateVoronoi4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var freqLoc: f32 = max(params.freq, 1e-6);

  let mode: u32 = params.voroMode;
  let edgeK: f32 = max(params.edgeK, 0.0);
  let threshold: f32 = max(params.threshold, 0.0);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time);
  } else {
    base = vec4<f32>(
      (pos.x + params.xShift) / zoom,
      (pos.y + params.yShift) / zoom,
      (pos.z + params.zShift) / zoom,
      params.time
    );
  }

  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let P = base * freqLoc;
    let m = voro4D_metrics(P);
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, threshold, freqLoc);

    sum += v * amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  return sum;
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Voronoi Tile Noise (Edge-Aware) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateVoronoiTileNoise(pos : vec3<f32>, params:NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);
  var sum   : f32 = 0.0;
  var amp   : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);

  let mode : u32 = params.voroMode;
  let edgeK : f32 = max(params.edgeK, 0.0);
  let thresh : f32 = max(params.threshold, 0.0);

  var x = (pos.x + params.xShift) / zoom;
  var y = (pos.y + params.yShift) / zoom;
  var z = (pos.z + params.zShift) / zoom;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let P = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);
    let m = voro3D_metrics(P);
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, thresh, freqLoc);

    sum = sum + v * amp;

    freqLoc = freqLoc * params.lacunarity;
    amp     = amp * params.gain;

    x = x + params.xShift;
    y = y + params.yShift;
    z = z + params.zShift;
  }

  return sum;
}


// BM1: f( f(p) )
fn generateVoronoiBM1(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoiTileNoise(p, par);
  return generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);
}

// BM2: f( p + f(f(p)) )
fn generateVoronoiBM2(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoiTileNoise(p, par);
  let f2 = generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3: f( p + f(p + f(p)) )
fn generateVoronoiBM3(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoiTileNoise(p, par);
  let f2 = generateVoronoiTileNoise(p + vec3<f32>(f1 * par.zoom), par);
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);
}

/* ---- Voronoi Brownian-Motion flavours (4D) ---------------------------------- */

// BM1 4D: f( f(p) )  (scalar feedback into XYZ, keep W/time from params)
fn generateVoronoiBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoi4D(p, par);
  return generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);
}

// BM2 4D: f( p + f(f(p)) )
fn generateVoronoiBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoi4D(p, par);
  let f2 = generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3 4D: f( p + f(p + f(p)) )
fn generateVoronoiBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoi4D(p, par);
  let f2 = generateVoronoi4D(p + vec3<f32>(f1 * par.zoom), par);
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);
}

/* ---- vector-feedback variants (stronger, less axis-locked) ---------
   These keep it cheap but reduce the "all axes get same scalar" look by building
   a 3-vector from 3 decorrelated samples (offsets are constant, no extra params).
*/

fn _bm4D_vec(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = generateVoronoi4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = generateVoronoi4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = generateVoronoi4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}

// BM1 4D (vec): f( vec(f(p)) )
fn generateVoronoiBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec(p, par);
  return generateVoronoi4D(v1 * par.zoom, par);
}

// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )
fn generateVoronoiBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec(p, par);
  let v2 = _bm4D_vec(v1 * par.zoom, par);
  return generateVoronoi4D(p + v2 * par.zoom, par);
}

// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )
fn generateVoronoiBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec(p, par);
  let v2 = _bm4D_vec(p + v1 * par.zoom, par);
  return generateVoronoi4D(p + v2 * par.zoom, par);
}

// Generic "Voronoi-style" sampler for Cellular/Worley so they can share voro_eval modes.

struct VoroSample {
  f1Sq    : f32,
  f2Sq    : f32,
  cellVal : f32,
};

fn voro_sample3D(p: vec3<f32>) -> VoroSample {
  let fx = i32(floor(p.x));
  let fy = i32(floor(p.y));
  let fz = i32(floor(p.z));

  var d1: f32 = 1e9;
  var d2: f32 = 1e9;
  var cv: f32 = 0.0;

  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
        let xi = fx + dx;
        let yi = fy + dy;
        let zi = fz + dz;

        let rx = rand3u(xi, yi, zi);
        let ry = rand3u(yi, zi, xi);
        let rz = rand3u(zi, xi, yi);

        let px = f32(xi) + rx;
        let py = f32(yi) + ry;
        let pz = f32(zi) + rz;

        let dxv = px - p.x;
        let dyv = py - p.y;
        let dzv = pz - p.z;
        let dd  = dxv * dxv + dyv * dyv + dzv * dzv;

        if (dd < d1) {
          d2 = d1;
          d1 = dd;
          cv = rand3u(xi, zi, yi);
        } else if (dd < d2) {
          d2 = dd;
        }
      }
    }
  }

  return VoroSample(d1, d2, cv);
}

fn voro_sample4D(p: vec4<f32>) -> VoroSample {
  let fx = i32(floor(p.x));
  let fy = i32(floor(p.y));
  let fz = i32(floor(p.z));
  let fw = i32(floor(p.w));

  var d1: f32 = 1e9;
  var d2: f32 = 1e9;
  var cv: f32 = 0.0;

  for (var dw: i32 = -1; dw <= 1; dw = dw + 1) {
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
      for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
          let xi = fx + dx;
          let yi = fy + dy;
          let zi = fz + dz;
          let wi = fw + dw;

          let rx = rand4u(xi, yi, zi, wi);
          let ry = rand4u(yi, zi, wi, xi);
          let rz = rand4u(zi, wi, xi, yi);
          let rw = rand4u(wi, xi, yi, zi);

          let px = f32(xi) + rx;
          let py = f32(yi) + ry;
          let pz = f32(zi) + rz;
          let pw = f32(wi) + rw;

          let dxv = px - p.x;
          let dyv = py - p.y;
          let dzv = pz - p.z;
          let dwv = pw - p.w;
          let dd  = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;

          if (dd < d1) {
            d2 = d1;
            d1 = dd;
            cv = rand4u(xi, zi, yi, wi);
          } else if (dd < d2) {
            d2 = dd;
          }
        }
      }
    }
  }

  return VoroSample(d1, d2, cv);
}

fn cellular4D(p: vec4<f32>) -> f32 {
  let s = voro_sample4D(p);
  return voro_edge_dist(s.f1Sq, s.f2Sq);
}

fn worley4D(p: vec4<f32>) -> f32 {
  let s = voro_sample4D(p);
  return sqrt(max(s.f1Sq, 0.0));
}

// Expects you to pass the same controls you use for Voronoi: params.voroMode, params.edgeK, params.threshold.
fn generateCellular(pos: vec3<f32>, params: NoiseParams) -> f32 {
  var x = (pos.x + params.xShift) / params.zoom;
  var y = (pos.y + params.yShift) / params.zoom;
  var z = (pos.z + params.zShift) / params.zoom;

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));

    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { n = abs(n); }
    n = clamp(n, 0.0, 1.0);

    sum = sum + n * amp;

    freqLoc = freqLoc * params.lacunarity;
    amp     = amp     * params.gain;

    let c = cos(angle);
    let sA = sin(angle);
    let nx = x * c - y * sA;
    let ny = x * sA + y * c;
    let nz = y * sA + z * c;

    x = nx + params.xShift;
    y = ny + params.yShift;
    z = nz + params.zShift;
    angle = angle + ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) { sum = sum - 1.0; }
  return 2.0 * sum - 1.0;
}

fn generateAntiCellular(pos: vec3<f32>, params: NoiseParams) -> f32 { 
  return -generateCellular(pos,params);
}

fn generateWorley(pos: vec3<f32>, params: NoiseParams) -> f32 {
  var x = (pos.x + params.xShift) / params.zoom;
  var y = (pos.y + params.yShift) / params.zoom;
  var z = (pos.z + params.zShift) / params.zoom;

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));

    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { n = abs(n); }
    n = clamp(n, 0.0, 1.0);

    sum = sum + n * amp;

    freqLoc = freqLoc * params.lacunarity;
    amp     = amp     * params.gain;

    let c = cos(angle);
    let sA = sin(angle);
    let nx = x * c - y * sA;
    let ny = x * sA + y * c;
    let nz = y * sA + z * c;

    x = nx + params.xShift;
    y = ny + params.yShift;
    z = nz + params.zShift;
    angle = angle + ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) { sum = sum - 1.0; }
  return sum - 1.0;
}

fn generateAntiWorley(pos: vec3<f32>, params: NoiseParams) -> f32 { 
  return -generateWorley(pos,params);
}

fn generateCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample4D(base * freqLoc);

    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { v = abs(v); }
    v = clamp(v, 0.0, 1.0);

    sum += v * amp;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let sA = sin(angle);
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (params.turbulence == 1u) { sum -= 1.0; }
  return 2.0 * sum - 1.0;
}

fn generateAntiCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return -generateCellular4D(pos,params);
}

fn generateWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum    : f32 = 0.0;
  var amp    : f32 = 1.0;
  var ampSum : f32 = 0.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle  : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample4D(base * freqLoc);

    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { v = abs(v); }
    v = clamp(v, 0.0, 1.0);

    sum    += v * amp;
    ampSum += amp;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let sA = sin(angle);
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  let out = select(0.0, sum / ampSum, ampSum > 0.0);

  if (params.turbulence == 1u) { return clamp(out - 1.0, -1.0, 1.0); }
  return clamp(1.0 - out, 0.0, 1.0);
}

fn generateAntiWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return 1-generateWorley4D(pos,params);
}

/* ---- Cellular Brownian-Motion flavours (4D) ---------------------------------- */

// BM1 4D: f( f(p) )
fn generateCellularBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateCellular4D(p, par);
  return generateCellular4D(vec3<f32>(f1 * par.zoom), par);
}

// BM2 4D: f( p + f(f(p)) )
fn generateCellularBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateCellular4D(p, par);
  let f2 = generateCellular4D(vec3<f32>(f1 * par.zoom), par);
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3 4D: f( p + f(p + f(p)) )
fn generateCellularBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateCellular4D(p, par);
  let f2 = generateCellular4D(p + vec3<f32>(f1 * par.zoom), par);
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);
}


/* ---- Worley Brownian-Motion flavours (4D) ----------------------------------- */

// BM1 4D: f( f(p) )
fn generateWorleyBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateWorley4D(p, par);
  return generateWorley4D(vec3<f32>(f1 * par.zoom), par);
}

// BM2 4D: f( p + f(f(p)) )
fn generateWorleyBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateWorley4D(p, par);
  let f2 = generateWorley4D(vec3<f32>(f1 * par.zoom), par);
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3 4D: f( p + f(p + f(p)) )
fn generateWorleyBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateWorley4D(p, par);
  let f2 = generateWorley4D(p + vec3<f32>(f1 * par.zoom), par);
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);
}


/* ---- vector-feedback variants (stronger, less axis-locked) ------------------ */

fn _bm4D_vec_cellular(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = generateCellular4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = generateCellular4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = generateCellular4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}

fn _bm4D_vec_worley(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = generateWorley4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = generateWorley4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = generateWorley4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}


// BM1 4D (vec): f( vec(f(p)) )
fn generateCellularBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_cellular(p, par);
  return generateCellular4D(v1 * par.zoom, par);
}

// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )
fn generateCellularBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_cellular(p, par);
  let v2 = _bm4D_vec_cellular(v1 * par.zoom, par);
  return generateCellular4D(p + v2 * par.zoom, par);
}

// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )
fn generateCellularBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_cellular(p, par);
  let v2 = _bm4D_vec_cellular(p + v1 * par.zoom, par);
  return generateCellular4D(p + v2 * par.zoom, par);
}


// BM1 4D (vec): f( vec(f(p)) )
fn generateWorleyBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_worley(p, par);
  return generateWorley4D(v1 * par.zoom, par);
}

// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )
fn generateWorleyBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_worley(p, par);
  let v2 = _bm4D_vec_worley(v1 * par.zoom, par);
  return generateWorley4D(p + v2 * par.zoom, par);
}

// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )
fn generateWorleyBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_worley(p, par);
  let v2 = _bm4D_vec_worley(p + v1 * par.zoom, par);
  return generateWorley4D(p + v2 * par.zoom, par);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var freqLoc: f32 = max(params.freq, 1e-6);
  var ampSum: f32 = 0.0;
  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let n = noise4D(base * freqLoc);
    let b = pow(abs(n), 0.75);
    sum += b * amp;
    ampSum += amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (ampSum > 0.0) { sum /= ampSum; }

  let k: f32 = 1.2;
  let cMid = sum - 0.5;
  let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));

  return clamp(shaped, 0.0, 1.0);
}

fn generateAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return 1.0 - generateBillow4D(pos, params);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Terrace + Foam + Turbulence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateTerraceNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let base = generatePerlin4D(pos, par);
  return terrace(base, par.terraceStep);
}

fn generateFoamNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let base = generateBillow4D(pos, par);
  return foamify(base);
}

fn generateTurbulence4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let base = generatePerlin4D(pos, par);
  return turbulence(base);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D "Lanczos-like" Lowpass \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn lowpass4D(p: vec4<f32>) -> f32 {
  let o = vec4<f32>(0.37, 0.21, 0.29, 0.31);
  let a = noise4D(p);
  let b = noise4D(p + vec4<f32>(o.x, 0.0, 0.0, 0.0));
  let c = noise4D(p + vec4<f32>(0.0, o.y, 0.0, 0.0));
  let d = noise4D(p + vec4<f32>(0.0, 0.0, o.z, 0.0));
  let e = noise4D(p + vec4<f32>(0.0, 0.0, 0.0, o.w));
  return (a + b + c + d + e) * 0.2;
}

fn generateLanczosBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var ampSum: f32 = 0.0;
  var freqLoc: f32 = max(params.freq, 1e-6);
  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let n = lowpass4D(base * freqLoc);
    let b = pow(abs(n), 0.75);
    sum += b * amp;
    ampSum += amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (ampSum > 0.0) { sum /= ampSum; }

  let k: f32 = 1.2;
  let cMid = sum - 0.5;
  let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));

  return clamp(shaped, 0.0, 1.0);
}

fn generateLanczosAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return 1.0 - generateLanczosBillow4D(pos, params);
}



// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D FBM core + generators \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn fbm4D_core(base: vec4<f32>, params: NoiseParams) -> f32 {
  var p = base;

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var maxAmp: f32 = 0.0;
  var freqLoc: f32 = max(params.freq, 1e-6);

  var angle: f32 = params.seedAngle;
  let angleInc: f32 = 2.0 * PI / max(f32(params.octaves), 1.0);

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    sum += amp * noise4D(p * freqLoc);
    maxAmp += amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      angle += angleInc;
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(p.x * c - p.y * s, p.x * s + p.y * c);
      let zw = vec2<f32>(p.z * c - p.w * s, p.z * s + p.w * c);
      p = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
    }
  }

  return select(0.0, sum / maxAmp, maxAmp > 0.0);
}

fn fbm4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  if (params.toroidal == 1u) {
    let base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;
    return fbm4D_core(base, params);
  }

  let base = vec4<f32>(
    (pos.x + params.xShift) / zoom,
    (pos.y + params.yShift) / zoom,
    (pos.z + params.zShift) / zoom,
    params.time
  );
  return fbm4D_core(base, params);
}

fn generateFBM4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let fbm1 = fbm4D(pos, params);
  let fbm2 = fbm4D_core(vec4<f32>(fbm1, fbm1, fbm1, fbm1), params);
  return 2.0 * fbm2;
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM (4D)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/

fn domainWarpFBM4D(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {
  var q = p;
  for (var i: u32 = 0u; i < stages; i = i + 1u) {
    let w = fbm4D(q, params) * warpAmp;
    q = q + vec3<f32>(w, w, w);
  }
  return fbm4D(q, params);
}

fn generateDomainWarpFBM1_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D(pos, par, par.warpAmp, 1u);
}

fn generateDomainWarpFBM2_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D(pos, par, par.warpAmp, 2u);
}

fn _warpVecFrom4D(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = fbm4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = fbm4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = fbm4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}

fn domainWarpFBM4D_vec(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {
  var q = p;
  for (var i: u32 = 0u; i < stages; i = i + 1u) {
    let v = _warpVecFrom4D(q, params) * warpAmp;
    q = q + v;
  }
  return fbm4D(q, params);
}

fn generateDomainWarpFBM1_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 1u);
}

fn generateDomainWarpFBM2_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 2u);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateLanczosBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {
    var x       = (pos.x + p.xShift) / p.zoom;
    var y       = (pos.y + p.yShift) / p.zoom;
    var z       = (pos.z + p.zShift) / p.zoom;
    var sum     : f32 = 0.0;
    var maxAmp  : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = max(p.freq, 1e-6);
    var angle   : f32 = p.seedAngle;

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        let n = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        sum = sum + (2.0 * abs(n) - 1.0) * amp;
        maxAmp = maxAmp + amp;

        freqLoc = freqLoc * p.lacunarity;
        amp     = amp     * p.gain;

        // rotation around Z
        let c = cos(angle);
        let s = sin(angle);
        var newX = x * c - y * s;
        var newY = x * s + y * c;
        var newZ = z;

        // rotate in XZ plane
        let rX = newX * c + newZ * s;
        let rZ = -newX * s + newZ * c;
        newX = rX; newZ = rZ;

        // rotate in YZ plane
        let rY = newY * c - newZ * s;
        let rZ2 = newY * s + newZ * c;
        newY = rY; newZ = rZ2;

        // apply shift
        x = newX + p.xShift;
        y = newY + p.yShift;
        z = newZ + p.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    return sum / maxAmp;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Anti-Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateLanczosAntiBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {
    return -generateLanczosBillow(pos, p);
}


// Raw Voronoi circle\u2010gradient cell value
fn voronoiCircleGradient(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let minDist = sqrt(max(m.f1Sq, 0.0));
    let secondDist = sqrt(max(m.f2Sq, 0.0));

    let centerGrad = 1.0 - min(minDist, 1.0);
    let edgeDist = max(secondDist - minDist, 0.0);
    let edgeGrad = select(1.0, 0.0, edgeDist < params.threshold);
    let legacyCellValue = centerGrad * edgeGrad;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * centerGrad, legacyCellValue, params.voroMode == VORO_CELL);
}

// Octaved generator matching your JS .generateNoise()
fn generateVoronoiCircleNoise(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x       = pos.x / zoom + params.xShift;
    var y       = pos.y / zoom + params.yShift;
    var z       = pos.z / zoom + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiCircleGradient(samplePos, params) * amp;

        // next octave
        amp  = amp  * params.gain;
        freq = freq * params.lacunarity;
        x    = x + params.xShift;
        y    = y + params.yShift;
        z    = z + params.zShift;
    }

    // match JS: return \u2211noise \u2212 1.0
    return total - 1.0;
}




// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 distance helpers (add once) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn euclideanDist(a: vec3<f32>, b: vec3<f32>) -> f32 {
  return length(a - b);
}
fn euclideanDistSq(a: vec3<f32>, b: vec3<f32>) -> f32 {
  let d = a - b;
  return dot(d, d);
}

fn euclideanDist2(a: vec2<f32>, b: vec2<f32>) -> f32 {
  return length(a - b);
}
fn euclideanDistSq2(a: vec2<f32>, b: vec2<f32>) -> f32 {
  let d = a - b;
  return dot(d, d);
}

fn euclideanDist4(a: vec4<f32>, b: vec4<f32>) -> f32 {
  return length(a - b);
}
fn euclideanDistSq4(a: vec4<f32>, b: vec4<f32>) -> f32 {
  let d = a - b;
  return dot(d, d);
}


// \u2500\u2500\u2500\u2500\u2500 1. Voronoi Circle\u2010Gradient Tile Noise 2 \u2500\u2500\u2500\u2500\u2500

fn voronoiCircleGradient2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let centerDist = sqrt(max(m.f1Sq, 0.0));
    let gradient = sin(centerDist * PI);
    let legacyCellValue = m.cellVal * gradient;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * gradient, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiCircle2(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);

    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiCircleGradient2Raw(samplePos, params) * amp;
        amp   = amp * params.gain;
        freq  = freq * params.lacunarity;
        angle = angle + angleInc;
        x = x + params.xShift * cos(angle) + params.xShift;
        y = y + params.yShift * cos(angle) + params.yShift;
        z = z + params.zShift * cos(angle) + params.zShift;
    }
    return total - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500 2. Voronoi Flat\u2010Shade Tile Noise \u2500\u2500\u2500\u2500\u2500

fn voronoiFlatShadeRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist    : f32 = 1e9;
    var secondDist : f32 = 1e9;

    for(var dz = -1; dz <= 1; dz = dz + 1) {
        for(var dy = -1; dy <= 1; dy = dy + 1) {
            for(var dx = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),
                                        f32(yi) + rand3u(yi, zi, xi),
                                        f32(zi) + rand3u(zi, xi, yi));
                let d = euclideanDist(feature, pos);
                if(d < minDist) {
                    secondDist = minDist;
                    minDist    = d;
                } else if(d < secondDist) {
                    secondDist = d;
                }
            }
        }
    }
    let edgeDist = secondDist - minDist;
    return select(1.0, 0.0, edgeDist < params.threshold);
}

fn generateVoronoiFlatShade(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var pos = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        total = total + voronoiFlatShadeRaw(pos * freq, params) * amp;
        amp  = amp * params.gain;
        freq = freq * params.lacunarity;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }
    return total;
}

// \u2500\u2500\u2500\u2500\u2500 3. Voronoi Ripple 3D \u2500\u2500\u2500\u2500\u2500

fn voronoiRipple3DRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let edgeDist = voro_edge_dist(m.f1Sq, m.f2Sq);
    let ripple = sin(PI + edgeDist * PI * params.rippleFreq + params.time);
    let rippleAmp = (1.0 + ripple) * 0.5;
    let legacyCellValue = m.cellVal * rippleAmp;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * rippleAmp, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiRipple3D(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);
    for(var i: u32=0u; i<params.octaves; i=i+1u) {
        let sample = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiRipple3DRaw(sample, params) * amp;
        amp   = amp * params.gain;
        freq  = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}


// \u2500\u2500\u2500\u2500\u2500 4. Voronoi Ripple 3D 2 \u2500\u2500\u2500\u2500\u2500
fn voronoiRipple3D2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let edgeDist = voro_edge_dist(m.f1Sq, m.f2Sq);
    let ripple = sin(PI + params.zoom * edgeDist * PI * params.rippleFreq + params.time);
    let rippleAmp = (1.0 + ripple) * 0.5;
    let legacyCellValue = m.cellVal * rippleAmp;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * rippleAmp, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiRipple3D2(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let sample = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiRipple3D2Raw(sample, params) * amp;
        amp = amp * params.gain;
        freq = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500 5. Voronoi Circular Ripple 3D \u2500\u2500\u2500\u2500\u2500
fn voronoiCircularRippleRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let minDist = sqrt(max(m.f1Sq, 0.0));
    let ripple = sin(PI + minDist * PI * params.rippleFreq + params.time);
    let rippleAmp = (1.0 + ripple) * 0.5;
    let legacyCellValue = m.cellVal * rippleAmp;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * rippleAmp, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiCircularRipple(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let sample = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiCircularRippleRaw(sample, params) * amp;
        amp = amp * params.gain;
        freq = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}

// 6a. Fractal Voronoi Ripple 3D
fn generateFVoronoiRipple3D(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    // first FBM pass
    let fbm1 = generateVoronoiRipple3D(posIn, params);

    // prepare second\u2010pass params: keep everything the same except zoom=1
    var p2 = params;
    p2.zoom = 1.0;

    // second FBM pass, feeding the scalar result back into xyz
    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateVoronoiRipple3D(sample, p2);

    return 2.0 * fbm2;
}

// 6b. Fractal Voronoi Circular Ripple 3D
fn generateFVoronoiCircularRipple(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    // first FBM pass
    let fbm1 = generateVoronoiCircularRipple(posIn, params);

    // second\u2010pass with zoom=1
    var p2 = params;
    p2.zoom = 1.0;

    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateVoronoiCircularRipple(sample, p2);

    return 2.0 * fbm2;
}

// \u2014\u2014\u2014 continuousPermutation \u2014\u2014\u2014
fn continuousPermutation(value: f32) -> f32 {
    let iVal    = floor(value);
    let frac    = value - iVal;
    let i0      = i32(iVal);
    let idx1    = u32((i0 % 256 + 256) % 256);
    let idx2    = u32(((i0 + 1) % 256 + 256) % 256);
    let v1      = f32(perm(idx1));
    let v2      = f32(perm(idx2));
    return v1 + frac * (v2 - v1);
}

// \u2014\u2014\u2014 calculateRippleEffect \u2014\u2014\u2014
fn calculateRippleEffect(pos: vec3<f32>,
                         rippleFreq: f32,
                         neighborhoodSize: i32) -> f32 {
    var sum: f32 = 0.0;
    var count: f32 = 0.0;
    for (var dz = -neighborhoodSize; dz <= neighborhoodSize; dz = dz + 1) {
        for (var dy = -neighborhoodSize; dy <= neighborhoodSize; dy = dy + 1) {
            for (var dx = -neighborhoodSize; dx <= neighborhoodSize; dx = dx + 1) {
                let sample = vec3<f32>(
                    continuousPermutation(pos.x + f32(dx)),
                    continuousPermutation(pos.y + f32(dy)),
                    continuousPermutation(pos.z + f32(dz))
                );
                let d = length(sample - pos);
                sum = sum + sin(d * PI * rippleFreq);
                count = count + 1.0;
            }
        }
    }
    return sum / count;
}

// \u2014\u2014\u2014 generateRippleNoise \u2014\u2014\u2014
fn generateRippleNoise(pos: vec3<f32>, p: NoiseParams) -> f32 {
    let zoom = max(p.zoom, 1e-6);
    var x = pos.x / zoom + p.xShift;
    var y = pos.y / zoom + p.yShift;
    var z = pos.z / zoom + p.zShift;
    var sum: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = max(p.freq, 1e-6);
    var angle: f32 = p.seedAngle * 2.0 * PI;
    let angleInc = 2.0 * PI / max(f32(p.octaves), 1.0);
    let rippleFreqScaled = p.rippleFreq;
    let neigh = i32(p.exp1);

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        var n = /* your base noise fn */ lanczos3D(vec3<f32>(x * freq, y * freq, z * freq)) * amp;
        if (p.turbulence == 1u) {
            n = abs(n);
        }
        let rip = calculateRippleEffect(vec3<f32>(x * freq, y * freq, z * freq),
                                        rippleFreqScaled,
                                        neigh);
        sum = sum + n * rip;

        freq   = freq * p.lacunarity;
        amp    = amp * p.gain;
        angle  = angle + angleInc;

        // simple phase offset; replace 0.0 with a hash if desired
        let phase: f32 = 0.0;
        x = x + p.xShift * cos(angle + phase);
        y = y + p.yShift * cos(angle + phase);
        z = z + p.zShift * cos(angle + phase);
    }

    if (p.turbulence == 1u) {
        sum = sum - 1.0;
    }
    return f32(p.octaves) * sum;
}

// \u2014\u2014\u2014 generateFractalRipples \u2014\u2014\u2014
fn generateFractalRipples(posIn: vec3<f32>, p: NoiseParams) -> f32 {
    // first pass at zoom scaled by exp2
    var p1 = p;
    p1.zoom = p.zoom * p.exp2+1.5;
    let fbm1 = generateRippleNoise(posIn, p1);

    // second pass feeding fbm1 back into xyz
    var p2 = p;
    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateRippleNoise(sample, p2);

    return 2.0 * fbm2;
}

// \u2014\u2014\u2014 1. HexWorms Raw \u2014\u2014\u2014
fn hexWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let steps       : u32 = 5u;
    let persistence : f32 = 0.5;
    var total       : f32 = 0.0;
    var frequency   : f32 = 1.0;
    var amplitude   : f32 = 1.0;

    for (var i: u32 = 0u; i < steps; i = i + 1u) {
        // base cellular noise for direction
        let angle = generateCellular(pos * frequency, params) * 2.0 * PI;

        // step along the \u201Cworm\u201D
        let offset = vec3<f32>(
            cos(angle),
            sin(angle),
            sin(angle)
        ) * 0.5;
        let samplePos = pos + offset;

        // accumulate
        total = total + generateCellular(samplePos, params) * amplitude;

        amplitude = amplitude * persistence;
        frequency = frequency * 2.0;
    }

    // match JS: subtract 1 at the end
    return total - 1.0;
}

// \u2014\u2014\u2014 2. HexWorms Generator \u2014\u2014\u2014
fn generateHexWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var pos   = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);
    var sum   : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + hexWormsRaw(pos * freq, params) * amp;
        freq = freq * params.lacunarity;
        amp  = amp * params.gain;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }

    return sum;
}

// \u2014\u2014\u2014 3. PerlinWorms Raw \u2014\u2014\u2014
fn perlinWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let steps       : u32 = 5u;
    let persistence : f32 = 0.5;
    var total       : f32 = 0.0;
    var frequency   : f32 = 1.0;
    var amplitude   : f32 = 1.0;

    for (var i: u32 = 0u; i < steps; i = i + 1u) {
        // base Perlin noise for direction
        let angle = generatePerlin(pos * frequency, params) * 2.0 * PI;

        // step along the \u201Cworm\u201D
        let offset = vec3<f32>(
            cos(angle),
            sin(angle),
            sin(angle)
        ) * 0.5;
        let samplePos = pos + offset;

        // accumulate
        total = total + generatePerlin(samplePos, params) * amplitude;

        amplitude = amplitude * persistence;
        frequency = frequency * 2.0;
    }

    return total;
}

// \u2014\u2014\u2014 PerlinWorms Generator \u2014\u2014\u2014
fn generatePerlinWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var pos   = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);
    var sum   : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + perlinWormsRaw(pos * freq, params) * amp;
        freq = freq * params.lacunarity;
        amp  = amp * params.gain;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }

    return sum;
}

// small helper: derive a few pseudorandom offsets from seed (u32)
fn seedOffsets(seed: u32) -> vec3<f32> {
  let s = f32(seed);
  let a = fract(sin(s * 12.9898) * 43758.5453);
  let b = fract(sin((s + 17.0) * 78.233) * 23421.631);
  let c = fract(sin((s + 31.0) * 37.719) * 97531.135);
  return vec3<f32>(a, b, c) * 0.5;
}

// safe tile sizes (u32) derived from Frame (avoid zero)
fn tileSizeX() -> u32 { return max(frame.tileWidth, 1u); }
fn tileSizeY() -> u32 { return max(frame.tileHeight, 1u); }
fn tileSizeZ() -> u32 { return max(frame.tileDepth, 1u); }

// --- helper: map pos -> integer pixel coords (uses frame uniform) ----------
// Returns wrapped pixel coords (periodic) so noise will tile across chunks.
fn posToPixelCoords_tiled(p : vec3<f32>) -> vec3<u32> {
  let fx = p.x * f32(frame.fullWidth);
  let fy = p.y * f32(frame.fullHeight);

  let ox_i : i32 = max(frame.originX, 0);
  let oy_i : i32 = max(frame.originY, 0);

  // integer pixel coords (unwrapped)
  let pxu : u32 = u32(floor(fx)) + u32(ox_i);
  let pyu : u32 = u32(floor(fy)) + u32(oy_i);

  let layer_i = max(frame.layerIndex, 0);
  let layer_u : u32 = u32(layer_i);

  // wrap coordinates into tile using modulo (cheap & correct for arbitrary tile sizes)
  let tx = tileSizeX();
  let ty = tileSizeY();
  let tz = tileSizeZ();
  let rx = pxu % tx;
  let ry = pyu % ty;
  let rz = layer_u % tz;

  return vec3<u32>(rx, ry, rz);
}

// --- deterministic integer hash that mixes seed (uses perm table) ---
// perm(...) implementation expected elsewhere (perm indexes 0..511)
fn hashed_with_seed(ix: u32, iy: u32, iz: u32, seed: u32) -> u32 {
  let a = perm((ix + seed * 1664525u) & 511u);
  let b = perm((a + (iy + seed * 22695477u)) & 511u);
  let c = perm((b + (iz + seed * 1103515245u)) & 511u);
  return c & 511u;
}
fn hashTo01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {
  return f32(hashed_with_seed(ix, iy, iz, seed)) / 511.0;
}
fn hashToSigned01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {
  return hashTo01_seeded(ix, iy, iz, seed) * 2.0 - 1.0;
}

// integer lattice helper consistent with the perm table, tiled by Frame sizes.
// p is continuous; freq and shifts control lattice alignment.
fn posToIntsForHash_tiled(p: vec3<f32>, freq: f32, sx: f32, sy: f32, sz: f32) -> vec3<u32> {
  let fx = floor(p.x * freq + sx);
  let fy = floor(p.y * freq + sy);
  let fz = floor(p.z * freq + sz);

  // cast and wrap to tile-size
  let tx = tileSizeX();
  let ty = tileSizeY();
  let tz = tileSizeZ();

  let ix = u32(fx) % tx;
  let iy = u32(fy) % ty;
  let iz = u32(fz) % tz;
  return vec3<u32>(ix, iy, iz);
}

// ---------------------- tiled value-noise 2D (smooth) ----------------------
// Uses posToIntsForHash_tiled internally => tiled/periodic by Frame tile sizes.
fn valueNoise2D_seeded(p : vec2<f32>, freq: f32, seed: u32, sx: f32, sy: f32) -> f32 {
  let f = max(freq, 1e-6);
  let fx = p.x * f + sx;
  let fy = p.y * f + sy;
  let ix_f = floor(fx);
  let iy_f = floor(fy);
  let txf = fx - ix_f;
  let tyf = fy - iy_f;

  // get tiled integer lattice coords (z = 0)
  let base = posToIntsForHash_tiled(vec3<f32>(ix_f, iy_f, 0.0), 1.0, 0.0, 0.0, 0.0);
  let ix = base.x;
  let iy = base.y;

  // neighbors (wrapped by tile in posToIntsForHash_tiled above)
  let ix1 = (ix + 1u) % tileSizeX();
  let iy1 = (iy + 1u) % tileSizeY();

  let h00 = hashToSigned01_seeded(ix,  iy,  0u, seed);
  let h10 = hashToSigned01_seeded(ix1, iy,  0u, seed);
  let h01 = hashToSigned01_seeded(ix,  iy1, 0u, seed);
  let h11 = hashToSigned01_seeded(ix1, iy1, 0u, seed);

  let sx_f = fade(txf);
  let sy_f = fade(tyf);
  let a = lerp(h00, h10, sx_f);
  let b = lerp(h01, h11, sx_f);
  return lerp(a, b, sy_f);
}

// ---------------------- White Noise (tiled, seeded, contrast/gain) ----
fn generateWhiteNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {
  let seed : u32 = params.seed;

  // integer pixel coords (wrapped to tile)
  let ip = posToPixelCoords_tiled(pos);

  // subsampling (blocky) or per-pixel; safe cast
  let subs = max(u32(max(params.freq, 1.0)), 1u);
  let sx = (ip.x / subs) % tileSizeX();
  let sy = (ip.y / subs) % tileSizeY();
  let sz = ip.z % tileSizeZ();

  var v01 = hashTo01_seeded(sx, sy, sz, seed);

  // apply contrast around 0.5 via params.gain
  let contrast = 1.0 + params.gain;
  v01 = (v01 - 0.5) * contrast + 0.5;

  return clamp(v01, 0.0, 1.0);
}

fn wrapCoordOffset(base: u32, offset: i32, size: u32) -> u32 {
  let s = max(i32(size), 1);
  let v = ((i32(base) + offset) % s + s) % s;
  return u32(v);
}

fn blueNoiseLocalRank(ip: vec3<u32>, seed: u32, radius: i32) -> f32 {
  let center = hashTo01_seeded(ip.x, ip.y, ip.z, seed);
  var lower = 0.0;
  var total = 0.0;

  for (var dy: i32 = -radius; dy <= radius; dy = dy + 1) {
    for (var dx: i32 = -radius; dx <= radius; dx = dx + 1) {
      if (dx == 0 && dy == 0) {
        continue;
      }

      let sx = wrapCoordOffset(ip.x, dx, tileSizeX());
      let sy = wrapCoordOffset(ip.y, dy, tileSizeY());
      let n = hashTo01_seeded(sx, sy, ip.z, seed);
      lower += select(0.0, 1.0, n < center);
      total += 1.0;
    }
  }

  return (lower + center) / (total + 1.0);
}

// ---------------------- Blue Noise Generator (tiled, seeded) -------------
fn generateBlueNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {
  let seed : u32 = params.seed;
  let ip0 = posToPixelCoords_tiled(pos);

  var ip = ip0;
  if (params.warpAmp > 0.0) {
    let jx = i32(round(hashToSigned01_seeded(ip0.x + 5u, ip0.y + 11u, ip0.z + 17u, seed) * params.warpAmp * 2.0));
    let jy = i32(round(hashToSigned01_seeded(ip0.x + 19u, ip0.y + 23u, ip0.z + 29u, seed) * params.warpAmp * 2.0));
    ip = vec3<u32>(
      wrapCoordOffset(ip0.x, jx, tileSizeX()),
      wrapCoordOffset(ip0.y, jy, tileSizeY()),
      ip0.z
    );
  }

  let rankSmall = blueNoiseLocalRank(ip, seed, 1);
  let rankLarge = blueNoiseLocalRank(ip, seed ^ 0x9E3779B9u, 2);
  var result = mix(rankLarge, rankSmall, 0.65);

  let micro = hashTo01_seeded(ip.x + 37u, ip.y + 61u, ip.z + 17u, seed ^ 0x85EBCA6Bu);
  result = clamp(result + (micro - 0.5) * (1.0 / 25.0), 0.0, 1.0);

  let contrast = max(1.0 + params.gain, 0.05);
  result = clamp((result - 0.5) * contrast + 0.5, 0.0, 1.0);
  return result;
}

const HYDRO_TAU : f32 = 6.283185307179586;

fn clamp01(x: f32) -> f32 {
  return clamp(x, 0.0, 1.0);
}

fn hydroHash2(p: vec2<f32>) -> vec2<f32> {
  let k = vec2<f32>(0.3183099, 0.3678794);
  let q = p * k + k.yx;
  return -1.0 + 2.0 * fract(16.0 * k * fract(q.x * q.y * (q.x + q.y)));
}

fn safeNormalize2(v: vec2<f32>) -> vec2<f32> {
  let l = length(v);
  if (l > 1e-10) {
    return v / l;
  }
  return vec2<f32>(0.0, 0.0);
}

fn powInv(t: f32, power: f32) -> f32 {
  return 1.0 - pow(1.0 - clamp01(t), power);
}

fn easeOut(t: f32) -> f32 {
  let v = 1.0 - clamp01(t);
  return 1.0 - v * v;
}

fn smoothStart(t: f32, smoothing: f32) -> f32 {
  let s = max(smoothing, 1e-6);
  if (t >= s) {
    return t - 0.5 * s;
  }
  return 0.5 * t * t / s;
}

fn loadPrevClamped2D(fx: i32, fy: i32, fz: i32) -> vec4<f32> {
  let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
  let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);
  return loadPrevRGBA(cx, cy, fz);
}

fn fetchPosClamped2D(fx: i32, fy: i32, fz: i32) -> vec3<f32> {
  let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
  let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);
  return fetchPos(cx, cy, fz);
}

fn resolutionScale() -> f32 {
  let refRes = 1024.0;
  let curRes = max(min(f32(frame.fullWidth), f32(frame.fullHeight)), 1.0);
  return curRes / refRes;
}

fn resolveFiniteSlope2D(fx: i32, fy: i32, fz: i32) -> vec2<f32> {
  let hL = loadPrevClamped2D(fx - 1, fy, fz).x;
  let hR = loadPrevClamped2D(fx + 1, fy, fz).x;
  let hD = loadPrevClamped2D(fx, fy - 1, fz).x;
  let hU = loadPrevClamped2D(fx, fy + 1, fz).x;

  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x), 1e-6);
  let dy = max(abs(pU.y - pD.y), 1e-6);

  let dHdX = (hR - hL) / dx;
  let dHdY = (hU - hD) / dy;

  return vec2<f32>(dHdX, dHdY);
}

fn guideGaussian(dx: i32, dy: i32, sigmaPx: f32) -> f32 {
  let s = max(sigmaPx, 0.05);
  let d2 = f32(dx * dx + dy * dy);
  return exp(-0.5 * d2 / (s * s));
}

fn guideHeightAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {
  let sigmaPx = sigmaWorld * resolutionScale();

  var sumW = 0.0;
  var sumH = 0.0;

  for (var j: i32 = -4; j <= 4; j = j + 1) {
    for (var i: i32 = -4; i <= 4; i = i + 1) {
      let h = loadPrevClamped2D(fx + i, fy + j, fz).x;
      let w = guideGaussian(i, j, sigmaPx);
      sumW += w;
      sumH += h * w;
    }
  }

  return sumH / max(sumW, 1e-6);
}

fn drainBlurWeight(dx: i32, dy: i32, sigmaPx: f32) -> f32 {
  let s = max(sigmaPx, 0.05);
  let d2 = f32(dx * dx + dy * dy);
  return exp(-0.5 * d2 / (s * s));
}

fn blurredHeightAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {
  let sigmaPx = sigmaWorld * resolutionScale();

  var sumW = 0.0;
  var sumH = 0.0;

  for (var j: i32 = -4; j <= 4; j = j + 1) {
    for (var i: i32 = -4; i <= 4; i = i + 1) {
      let s = loadPrevClamped2D(fx + i, fy + j, fz).x;
      let w = drainBlurWeight(i, j, sigmaPx);
      sumW += w;
      sumH += s * w;
    }
  }

  return sumH / max(sumW, 1e-6);
}

fn blurredRidgeAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {
  let sigmaPx = sigmaWorld * resolutionScale();

  var sumW = 0.0;
  var sumR = 0.0;

  for (var j: i32 = -4; j <= 4; j = j + 1) {
    for (var i: i32 = -4; i <= 4; i = i + 1) {
      let s = loadPrevClamped2D(fx + i, fy + j, fz);
      let ridge = s.w * 2.0 - 1.0;
      let w = drainBlurWeight(i, j, sigmaPx);
      sumW += w;
      sumR += ridge * w;
    }
  }

  return sumR / max(sumW, 1e-6);
}

fn phacelleNoise(
  p: vec2<f32>,
  normDir: vec2<f32>,
  freq: f32,
  offset: f32,
  normalization: f32
) -> vec4<f32> {
  let sideDir = normDir.yx * vec2<f32>(-1.0, 1.0) * freq * HYDRO_TAU;
  let phaseOffset = offset * HYDRO_TAU;

  let pInt = floor(p);
  let pFrac = fract(p);

  var phaseDir = vec2<f32>(0.0);
  var weightSum = 0.0;

  for (var j: i32 = -1; j <= 2; j = j + 1) {
    for (var i: i32 = -1; i <= 2; i = i + 1) {
      let gridOffset = vec2<f32>(f32(i), f32(j));
      let gridPoint = pInt + gridOffset;
      let randomOffset = hydroHash2(gridPoint) * 0.5;
      let v = pFrac - gridOffset - randomOffset;

      let sqrDist = dot(v, v);
      var weight = exp(-sqrDist * 2.0);
      weight = max(0.0, weight - 0.01111);

      weightSum += weight;

      let waveInput = dot(v, sideDir) + phaseOffset;
      phaseDir += vec2<f32>(cos(waveInput), sin(waveInput)) * weight;
    }
  }

  let interpolated = phaseDir / max(weightSum, 1e-6);
  let mag = max(1.0 - normalization, length(interpolated));

  return vec4<f32>(interpolated / max(mag, 1e-6), sideDir);
}

fn pixelSpan2D(fx: i32, fy: i32, fz: i32) -> f32 {
  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x) * 0.5, 1e-6);
  let dy = max(abs(pU.y - pD.y) * 0.5, 1e-6);

  return max(dx, dy);
}


fn rotate2(v: vec2<f32>, angle: f32) -> vec2<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec2<f32>(v.x * c - v.y * s, v.x * s + v.y * c);
}

fn signed01(v: f32) -> f32 {
  return v * 2.0 - 1.0;
}

fn terrainDetailMapScalar(uv: vec2<f32>, baseFreq: f32) -> f32 {
  var value = 0.0;
  var amp = 0.5;
  var ampSum = 0.0;
  var freqLoc = max(baseFreq, 1e-6);

  for (var i: u32 = 0u; i < 8u; i = i + 1u) {
    value += noise2D(uv * freqLoc) * amp;
    ampSum += amp;
    amp *= 0.95;
    freqLoc *= 2.0;
  }

  return value / max(ampSum, 1e-6);
}

fn generateSmokeNoise(pos: vec3<f32>, paramsIn: NoiseParams) -> f32 {
  let baseFreq = max(paramsIn.freq, 0.25);
  let baseOctaves = max(paramsIn.octaves, 3u);
  let lac = max(paramsIn.lacunarity, 2.0);

  var warpParams = paramsIn;
  warpParams.freq = baseFreq * 0.9;
  warpParams.octaves = max(baseOctaves, 3u);
  warpParams.gain = 0.55;
  warpParams.lacunarity = lac;

  let warpX = signed01(generateSimplex(pos + vec3<f32>(17.31, 9.73, 3.11), warpParams));
  let warpY = signed01(generatePerlin(pos + vec3<f32>(-11.37, 14.51, 5.71), warpParams));
  let warpZ = signed01(generateSimplex(pos + vec3<f32>(5.91, -7.13, 11.29), warpParams));
  let warpAmp = 0.18 + max(paramsIn.warpAmp, 0.0) * 0.35;
  let qWarp = pos + vec3<f32>(warpX, warpY, 0.35 * warpZ) * warpAmp;

  var macroParams = paramsIn;
  macroParams.freq = baseFreq * 0.5;
  macroParams.octaves = max(baseOctaves + 1u, 4u);
  macroParams.gain = 0.55;
  macroParams.lacunarity = lac;
  let macroRidge = signed01(generateRidgedMultifractal4(qWarp, macroParams));

  var continentalParams = paramsIn;
  continentalParams.freq = baseFreq * 0.28;
  continentalParams.octaves = max(baseOctaves, 3u);
  continentalParams.gain = 0.5;
  continentalParams.lacunarity = lac;
  let continental = signed01(generateBillow(qWarp + vec3<f32>(2.7, -4.1, 1.3), continentalParams));

  var ridgeParams = paramsIn;
  ridgeParams.freq = baseFreq * 1.45;
  ridgeParams.octaves = max(baseOctaves, 4u);
  ridgeParams.gain = 0.52;
  ridgeParams.lacunarity = lac;
  let detailRidge = signed01(generateRidgedMultifractal2(qWarp * 1.05 + vec3<f32>(4.2, 1.7, 0.0), ridgeParams));

  var worleyParams = paramsIn;
  worleyParams.freq = baseFreq * 1.75;
  worleyParams.octaves = 1u;
  worleyParams.gain = 1.0;
  worleyParams.lacunarity = 2.0;
  let cells = 1.0 - generateWorley(qWarp + vec3<f32>(7.5, -3.2, 0.0), worleyParams);
  let cellular = signed01(generateCellular(qWarp * 1.1 + vec3<f32>(-5.3, 6.4, 0.0), worleyParams));

  var rippleParams = paramsIn;
  rippleParams.freq = baseFreq * 2.25;
  rippleParams.octaves = 4u;
  rippleParams.gain = 0.7;
  rippleParams.lacunarity = max(lac, 2.0);
  let rippleWarpX = signed01(generatePerlin(qWarp * 1.9 + vec3<f32>(8.7, 3.1, 0.0), rippleParams));
  let rippleWarpY = signed01(generateSimplex(qWarp * 1.9 + vec3<f32>(-6.2, 5.4, 0.0), rippleParams));
  let rippleCarrier = signed01(generateBillow(qWarp * 2.3 + vec3<f32>(3.6, -8.9, 0.0), rippleParams));
  let rippleAngle = 0.6 + 0.35 * signed01(generatePerlin(qWarp + vec3<f32>(1.9, -2.7, 0.0), warpParams));
  let ripplePos = rotate2(qWarp.xy + vec2<f32>(rippleWarpX, rippleWarpY) * 0.08, rippleAngle);
  let rippleFreq = max(paramsIn.rippleFreq, 1.0);
  let ripple = sin(ripplePos.x * rippleFreq + rippleCarrier * 2.8);
  let rippleEnvelope = 0.5 + 0.5 * signed01(generatePerlin(qWarp * 1.35 + vec3<f32>(10.1, 4.8, 0.0), rippleParams));

  let cellBlend = clamp01(0.3 + paramsIn.threshold * 0.9);
  let rippleBlend = clamp01(0.02 + 0.008 * max(paramsIn.rippleFreq, 1.0));

  var terrain = 0.0;
  terrain += macroRidge * 0.46;
  terrain += continental * 0.14;
  terrain += detailRidge * 0.21;
  terrain += signed01(cells) * (0.10 * cellBlend);
  terrain += cellular * (0.06 * cellBlend);
  terrain += ripple * rippleEnvelope * rippleBlend;

  let lifted = terrain * 0.5 + 0.5 + paramsIn.zShift;
  return clamp01(lifted);
}

fn terrainVoroModeSample(pos: vec3<f32>, freqLoc: f32, mode: u32, edgeK: f32, threshold: f32) -> f32 {
  let s = voro_sample3D(pos * freqLoc);
  return clamp01(voro_eval(s.f1Sq, s.f2Sq, s.cellVal, mode, edgeK, threshold, freqLoc));
}

fn terrainVoroModeSmooth(pos: vec3<f32>, freqLoc: f32, mode: u32, edgeK: f32, threshold: f32) -> f32 {
  let step = 0.006;
  let center = terrainVoroModeSample(pos, freqLoc, mode, edgeK, threshold);
  let x1 = terrainVoroModeSample(pos + vec3<f32>( step, 0.0, 0.0), freqLoc, mode, edgeK, threshold);
  let x2 = terrainVoroModeSample(pos + vec3<f32>(-step, 0.0, 0.0), freqLoc, mode, edgeK, threshold);
  let y1 = terrainVoroModeSample(pos + vec3<f32>(0.0,  step, 0.0), freqLoc, mode, edgeK, threshold);
  let y2 = terrainVoroModeSample(pos + vec3<f32>(0.0, -step, 0.0), freqLoc, mode, edgeK, threshold);
  let d1 = terrainVoroModeSample(pos + vec3<f32>( step,  step, 0.0), freqLoc, mode, edgeK, threshold);
  let d2 = terrainVoroModeSample(pos + vec3<f32>(-step,  step, 0.0), freqLoc, mode, edgeK, threshold);
  let d3 = terrainVoroModeSample(pos + vec3<f32>( step, -step, 0.0), freqLoc, mode, edgeK, threshold);
  let d4 = terrainVoroModeSample(pos + vec3<f32>(-step, -step, 0.0), freqLoc, mode, edgeK, threshold);
  return clamp01((center * 4.0 + x1 * 2.0 + x2 * 2.0 + y1 * 2.0 + y2 * 2.0 + d1 + d2 + d3 + d4) / 16.0);
}

fn generateTerrainNoise(pos: vec3<f32>, paramsIn: NoiseParams) -> f32 {
  let baseFreq = max(paramsIn.freq, 0.24);
  let baseOctaves = max(paramsIn.octaves, 4u);
  let lac = max(paramsIn.lacunarity, 2.0);
  let warpAmount = 0.035 + max(paramsIn.warpAmp, 0.0) * 0.055;

  var warpParams = paramsIn;
  warpParams.freq = baseFreq * 0.55;
  warpParams.octaves = max(baseOctaves, 3u);
  warpParams.gain = 0.52;
  warpParams.lacunarity = lac;

  let warpA = signed01(generatePerlin(pos + vec3<f32>(7.3, -5.9, 1.7), warpParams));
  let warpB = signed01(generateSimplex(pos + vec3<f32>(-3.1, 9.4, 2.6), warpParams));
  let q = pos + vec3<f32>(warpA, warpB, 0.0) * warpAmount;

  var macroParams = paramsIn;
  macroParams.freq = baseFreq * 0.56;
  macroParams.octaves = max(baseOctaves + 1u, 5u);
  macroParams.gain = 0.58;
  macroParams.lacunarity = lac;
  let macroRidgeRaw = signed01(generateRidgedMultifractal4(q + vec3<f32>(4.2, 1.9, 0.0), macroParams));
  let macroRidge = sign(macroRidgeRaw) * pow(abs(macroRidgeRaw), 1.18);

  var sharpParams = paramsIn;
  sharpParams.freq = baseFreq * 1.08;
  sharpParams.octaves = max(baseOctaves, 5u);
  sharpParams.gain = 0.53;
  sharpParams.lacunarity = lac;
  let sharpRidgeRaw = signed01(generateRidgedMultifractal2(q * 1.04 + vec3<f32>(-3.7, 2.6, 0.0), sharpParams));
  let sharpRidge = sign(sharpRidgeRaw) * pow(abs(sharpRidgeRaw), 1.30);

  var worleyParams = paramsIn;
  worleyParams.freq = baseFreq * 0.82;
  worleyParams.octaves = 1u;
  worleyParams.gain = 1.0;
  worleyParams.lacunarity = 2.0;
  let worleyA = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7, 0.0), worleyParams);
  let worleyB = 1.0 - generateWorley(q + vec3<f32>(6.3 + 0.012, -1.7, 0.0), worleyParams);
  let worleyC = 1.0 - generateWorley(q + vec3<f32>(6.3 - 0.012, -1.7, 0.0), worleyParams);
  let worleyD = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7 + 0.012, 0.0), worleyParams);
  let worleyE = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7 - 0.012, 0.0), worleyParams);
  let smoothedWorley = (worleyA * 4.0 + worleyB + worleyC + worleyD + worleyE) / 8.0;
  let worleySignal = signed01(smoothedWorley);
  let worleyCarve = smoothstep(0.38, 0.84, smoothedWorley);
  let worleyGrad = vec2<f32>(worleyB - worleyC, worleyD - worleyE);
  let worleyTangent = safeNormalize2(vec2<f32>(-worleyGrad.y, worleyGrad.x));

  var angleParams = paramsIn;
  angleParams.freq = baseFreq * 0.72;
  angleParams.octaves = max(baseOctaves, 3u);
  angleParams.gain = 0.50;
  angleParams.lacunarity = lac;
  let angleField = signed01(generatePerlin(q + vec3<f32>(2.1, -4.7, 0.0), angleParams));
  let baseDir = safeNormalize2(vec2<f32>(cos(angleField * 1.9), sin(angleField * 1.9)));
  let joinMix = smoothstep(0.18, 0.82, smoothedWorley);
  let lineDir = safeNormalize2(mix(baseDir, worleyTangent, 0.72 * joinMix));
  let sideDir = vec2<f32>(-lineDir.y, lineDir.x);

  var rippleParams = paramsIn;
  rippleParams.freq = baseFreq * 1.7;
  rippleParams.octaves = 3u;
  rippleParams.gain = 0.62;
  rippleParams.lacunarity = max(lac, 2.0);
  let rippleWarp = vec2<f32>(
    signed01(generatePerlin(q * 1.25 + vec3<f32>(8.7, 1.3, 0.0), rippleParams)),
    signed01(generateSimplex(q * 1.25 + vec3<f32>(-6.2, 4.8, 0.0), rippleParams))
  ) * 0.024;
  let rippleCarrier = signed01(generateBillow(q * 1.85 + vec3<f32>(3.1, -7.2, 0.0), rippleParams));

  let detailMap = terrainDetailMapScalar(q.xy * 0.60 + vec2<f32>(11.7, -5.3), 2.0);
  let detailSoft = detailMap * detailMap * (3.0 - 2.0 * detailMap);
  let detailSignal = signed01(detailSoft);

  let joinedCoord = dot(q.xy + rippleWarp, sideDir);
  let branchCoord = dot(
    q.xy + rippleWarp * 0.7,
    safeNormalize2(mix(sideDir, worleyTangent, 0.35))
  );
  let rippleFreq = max(paramsIn.rippleFreq, 1.0) * 0.42;
  let ripplePrimary =
    sin(joinedCoord * rippleFreq + smoothedWorley * 4.0 + rippleCarrier * 1.1 + detailSignal * 0.28);
  let rippleBranch =
    sin(branchCoord * rippleFreq * 1.05 + smoothedWorley * 3.2 + rippleCarrier * 0.7 + detailSignal * 0.18);
  let ripple = mix(ripplePrimary, rippleBranch, 0.32 + 0.28 * joinMix);
  let rippleMask =
    smoothstep(0.08, 0.88, abs(macroRidge)) *
    (0.28 + 0.72 * joinMix) *
    (0.92 + 0.08 * detailSoft);
  let rippleBlend = clamp01(0.026 + 0.006 * max(paramsIn.rippleFreq, 1.0));

  let detailMask =
    smoothstep(0.12, 0.88, smoothedWorley) *
    smoothstep(0.04, 0.72, abs(macroRidge));

  var terrain = 0.0;
  terrain += macroRidge * 0.40;
  terrain += sharpRidge * 0.16;
  terrain += worleySignal * 0.11;
  terrain -= worleyCarve * 0.10;
  terrain += ripple * rippleMask * rippleBlend;
  terrain += detailSignal * detailMask * 0.012;

  let shaped = sign(terrain) * pow(abs(terrain), 0.96);
  let lifted = shaped * 0.5 + 0.5 + paramsIn.zShift;
  return clamp01(lifted);
}

fn erosionFilter(
  p: vec2<f32>,
  heightAndSlopeIn: vec3<f32>,
  fadeTargetIn: f32,
  strengthIn: f32,
  gullyWeightIn: f32,
  carrierWeightIn: f32,
  steeringWeightIn: f32,
  detailIn: f32,
  roundingIn: vec4<f32>,
  onsetIn: vec4<f32>,
  assumedSlopeIn: vec2<f32>,
  scaleIn: f32,
  octavesIn: u32,
  lacunarityIn: f32,
  gainIn: f32,
  cellScaleIn: f32,
  normalizationIn: f32,
  pixelSpanIn: f32,
  ridgeMapOut: ptr<function, f32>
) -> vec4<f32> {
  var heightAndSlope = heightAndSlopeIn;
  var fadeTarget = clamp(fadeTargetIn, -1.0, 1.0);

  let inputHeightAndSlope = heightAndSlopeIn;

  var strength = strengthIn * scaleIn;
  var freq = 1.0 / max(scaleIn * cellScaleIn, 1e-6);
  let carrierSharpness = 1.75;
  let slopeLength = max(length(heightAndSlopeIn.yz), 1e-10);
  var magnitude = 0.0;
  var roundingMult = 1.0;

  let roundingForInput =
    mix(roundingIn.y, roundingIn.x, clamp01(fadeTarget * 0.5 + 0.5)) * roundingIn.z;

  var combiMask =
    easeOut(smoothStart(slopeLength * onsetIn.x, roundingForInput * onsetIn.x));

  var ridgeMapCombiMask = easeOut(slopeLength * onsetIn.z);
  var ridgeMapFadeTarget = fadeTarget;

  var gullySlope =
    mix(
      heightAndSlopeIn.yz,
      safeNormalize2(heightAndSlopeIn.yz) * assumedSlopeIn.x,
      assumedSlopeIn.y
    );

  let pixelSpan = max(pixelSpanIn, 1e-6);

  for (var i: u32 = 0u; i < octavesIn; i = i + 1u) {
    let stripeStep = freq * cellScaleIn * HYDRO_TAU * pixelSpan;
    let stripeMask = 1.0 - smoothstep(1.05, 2.40, stripeStep);

    if (stripeMask <= 1e-4) {
      break;
    }

    var phacelle =
      phacelleNoise(
        p * freq,
        safeNormalize2(gullySlope),
        cellScaleIn,
        0.25,
        normalizationIn
      );

    phacelle = vec4<f32>(phacelle.xy, phacelle.z * -freq, phacelle.w * -freq);
    let sloping = abs(phacelle.y);
    let carrierRaw = clamp(phacelle.x, -1.0, 1.0);
    let carrierPhase = sign(carrierRaw) * pow(abs(carrierRaw), carrierSharpness);

    let octaveStrength = strength * stripeMask;

    gullySlope += sign(phacelle.y) * phacelle.zw * octaveStrength * gullyWeightIn * steeringWeightIn;

    let visibleGullies = vec3<f32>(carrierPhase, phacelle.y * phacelle.zw) * carrierWeightIn;
    let fadedGullies =
      mix(vec3<f32>(fadeTarget, 0.0, 0.0), visibleGullies, combiMask);

    heightAndSlope += fadedGullies * octaveStrength;
    magnitude += octaveStrength;
    let fadedCarrier = mix(fadeTarget, carrierPhase, combiMask);
    fadeTarget = mix(fadeTarget, fadedCarrier, stripeMask);

    let roundingForOctave =
      mix(roundingIn.y, roundingIn.x, clamp01(carrierPhase * 0.5 + 0.5)) * roundingMult;

    let newMask =
      easeOut(smoothStart(sloping * onsetIn.y, roundingForOctave * onsetIn.y));

    combiMask = powInv(combiMask, detailIn) * mix(1.0, newMask, stripeMask);

    ridgeMapFadeTarget = mix(ridgeMapFadeTarget, carrierPhase, ridgeMapCombiMask * stripeMask);

    let newRidgeMapMask = easeOut(sloping * onsetIn.w);
    ridgeMapCombiMask = ridgeMapCombiMask * mix(1.0, newRidgeMapMask, stripeMask);

    strength *= gainIn;
    freq *= lacunarityIn;
    roundingMult *= roundingIn.w;
  }

  *ridgeMapOut = ridgeMapFadeTarget * (1.0 - ridgeMapCombiMask);

  let delta = heightAndSlope - inputHeightAndSlope;
  return vec4<f32>(delta, magnitude);
}

@compute @workgroup_size(8, 8, 1)
fn computeTerrainNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let pos = fetchPos(fx, fy, fz);
  let v0 = generateTerrainNoise(pos, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeSmokeNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let pos = fetchPos(fx, fy, fz);
  let v0 = generateSmokeNoise(pos, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeHydrologyErosionHeightfield(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (readFrom3D() || writeTo3D()) {
    return;
  }

  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let src = loadPrevClamped2D(fx, fy, fz);
  let pos = fetchPos(fx, fy, fz);

  var baseHeight = src.x;
  var guideHeight = src.x;
  let rawSlope = resolveFiniteSlope2D(fx, fy, fz);
  var guideSlope = rawSlope;

  if (params.turbulence != 0u) {
    baseHeight = src.w;
    guideHeight = src.x;
    guideSlope = src.yz;

    if (length(guideSlope) < 1e-8) {
      guideSlope = rawSlope;
    }
  }

  let steerSlope = mix(rawSlope, guideSlope, 0.82);
  let fadeHeight = mix(baseHeight, guideHeight, 0.35);

  var erosionScale = params.zoom;
  if (abs(erosionScale) < 1e-6) {
    erosionScale = 0.15;
  }

  var domainScale = params.freq;
  if (abs(domainScale) < 1e-6) {
    domainScale = 1.0;
  }

  var erosionStrength = options.heightScale;
  if (abs(erosionStrength) < 1e-6) {
    erosionStrength = 1.0;
  }
  erosionStrength *= 0.22;

  var gullyWeight = params.exp1;
  if (abs(gullyWeight) < 1e-6) {
    gullyWeight = 0.5;
  }

  var carrierWeight = max(params.edgeK, 0.0);
  if (carrierWeight < 1e-6) {
    carrierWeight = 0.24;
  }
  carrierWeight = clamp01(carrierWeight);

  var steeringWeight = max(params.time, 0.0);
  if (steeringWeight < 1e-6) {
    steeringWeight = 1.10;
  }

  var detail = params.seedAngle;
  if (abs(detail) < 1e-6) {
    detail = 1.5;
  }

  var fadeScale = params.exp2;
  if (abs(fadeScale) < 1e-6) {
    fadeScale = 1.6666667;
  }

  var cellScale = params.threshold;
  if (abs(cellScale) < 1e-6) {
    cellScale = 0.7;
  }

  var normalization = params.rippleFreq;
  if (abs(normalization) < 1e-6) {
    normalization = 0.5;
  }
  normalization = clamp01(normalization);

  var assumedSlopeValue = params.warpAmp;
  if (abs(assumedSlopeValue) < 1e-6) {
    assumedSlopeValue = 0.7;
  }
  assumedSlopeValue = max(assumedSlopeValue, 1e-4);

  var assumedSlopeMix = params.gaborRadius;
  if (abs(assumedSlopeMix) < 1e-6) {
    assumedSlopeMix = 1.0;
  }
  assumedSlopeMix = clamp01(assumedSlopeMix);

  var onsetScale = params.terraceStep;
  if (abs(onsetScale) < 1e-6) {
    onsetScale = 8.0;
  }
  onsetScale = max(onsetScale / 8.0, 1e-4);

  let rounding = vec4<f32>(
    0.10,
    0.00,
    0.10,
    max(params.lacunarity, 1.0)
  );

  let onset = vec4<f32>(
    1.25,
    1.25,
    2.80,
    1.50
  ) * onsetScale;

  let assumedSlope = vec2<f32>(assumedSlopeValue, assumedSlopeMix);

  let seedShift = vec2<f32>(
    f32(params.seed & 65535u) * 0.00001173,
    f32((params.seed >> 16u) & 65535u) * 0.00000937
  );

  let domainP =
    pos.xy * domainScale +
    vec2<f32>(params.xShift, params.yShift) +
    seedShift;

  let fadeTarget = clamp(((fadeHeight - 0.5 + params.zShift) * 2.0) * fadeScale, -1.0, 1.0);
  let pixelSpan = pixelSpan2D(fx, fy, fz);

  var ridgeMap = 0.0;
  let h = erosionFilter(
    domainP,
    vec3<f32>(baseHeight, steerSlope.x, steerSlope.y),
    fadeTarget,
    erosionStrength,
    gullyWeight,
    carrierWeight,
    steeringWeight,
    detail,
    rounding,
    onset,
    assumedSlope,
    erosionScale,
    max(params.octaves, 1u),
    max(params.lacunarity, 1.0),
    max(params.gain, 1e-4),
    cellScale,
    normalization,
    pixelSpan,
    &ridgeMap
  );

  let terrainHeightOffsetConst = options.baseRadius;

  let offset = terrainHeightOffsetConst * h.w;

  let erodedHeight = baseHeight + h.x + offset;
  let outSlope = steerSlope + h.yz;
  let ridgeMapEncoded = clamp01(ridgeMap * 0.5 + 0.5);

  storeRGBA(
    fx,
    fy,
    fz,
    vec4<f32>(erodedHeight, outSlope.x, outSlope.y, ridgeMapEncoded)
  );
}

@compute @workgroup_size(8, 8, 1)
fn computeHydrologyGuideField(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (readFrom3D() || writeTo3D()) {
    return;
  }

  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let src = loadPrevClamped2D(fx, fy, fz);
  let rawHeight = src.x;

  var sigma = abs(params.threshold);
  if (sigma < 1e-6) {
    sigma = 0.90;
  }

  var guideBlend = params.exp1;
  if (abs(guideBlend) < 1e-6) {
    guideBlend = 0.35;
  }
  guideBlend = clamp01(guideBlend);

  let blurredC = guideHeightAt(fx, fy, fz, sigma);
  let blurredL = guideHeightAt(fx - 1, fy, fz, sigma);
  let blurredR = guideHeightAt(fx + 1, fy, fz, sigma);
  let blurredD = guideHeightAt(fx, fy - 1, fz, sigma);
  let blurredU = guideHeightAt(fx, fy + 1, fz, sigma);

  let guideHeight = mix(rawHeight, blurredC, guideBlend);
  let guideL = mix(loadPrevClamped2D(fx - 1, fy, fz).x, blurredL, guideBlend);
  let guideR = mix(loadPrevClamped2D(fx + 1, fy, fz).x, blurredR, guideBlend);
  let guideD = mix(loadPrevClamped2D(fx, fy - 1, fz).x, blurredD, guideBlend);
  let guideU = mix(loadPrevClamped2D(fx, fy + 1, fz).x, blurredU, guideBlend);

  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x), 1e-6);
  let dy = max(abs(pU.y - pD.y), 1e-6);

  let guideSlopeX = (guideR - guideL) / dx;
  let guideSlopeY = (guideU - guideD) / dy;

  storeRGBA(
    fx,
    fy,
    fz,
    vec4<f32>(guideHeight, guideSlopeX, guideSlopeY, rawHeight)
  );
}

fn computeHydroDrainageField(fx: i32, fy: i32, fz: i32) -> vec4<f32> {
  let coarseSigma = 1.75;

  let hC = blurredHeightAt(fx, fy, fz, coarseSigma);
  let hL = blurredHeightAt(fx - 1, fy, fz, coarseSigma);
  let hR = blurredHeightAt(fx + 1, fy, fz, coarseSigma);
  let hD = blurredHeightAt(fx, fy - 1, fz, coarseSigma);
  let hU = blurredHeightAt(fx, fy + 1, fz, coarseSigma);

  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x), 1e-6);
  let dy = max(abs(pU.y - pD.y), 1e-6);

  let slope = vec2<f32>(
    (hR - hL) / dx,
    (hU - hD) / dy
  );

  let flowDir = -safeNormalize2(slope);

  let ridgeBroad = blurredRidgeAt(fx, fy, fz, 1.6);
  let valleyPrior = 1.0 - smoothstep(-0.12, 0.08, ridgeBroad);

  let valleyDepth = max(0.0, (hL + hR + hD + hU) * 0.25 - hC);
  let concavityGain = max(abs(params.edgeK), 1e-4) * 36.0;
  let concavityMask = clamp01(valleyDepth * concavityGain);

  let slopeOnset = max(abs(params.warpAmp), 1e-4);
  let slopeMask = easeOut(clamp01(length(slope) / slopeOnset));

  let contrast = max(abs(params.exp1), 1e-4);
  let gain = max(abs(params.exp2), 1e-4);

  var drainage = valleyPrior * concavityMask * slopeMask;
  drainage = pow(clamp01(drainage), contrast);
  drainage = clamp01(drainage * gain);

  return vec4<f32>(
    drainage,
    valleyPrior,
    flowDir.x * 0.5 + 0.5,
    flowDir.y * 0.5 + 0.5
  );
}

@compute @workgroup_size(8, 8, 1)
fn computeHydrologyDrainageMask(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (readFrom3D() || writeTo3D()) {
    return;
  }

  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let outCol = computeHydroDrainageField(fx, fy, fz);
  storeRGBA(fx, fy, fz, outCol);
}

// Shared tiling constants
const WGX : u32 = 8u;
const WGY : u32 = 8u;
const TILE_W : u32 = WGX + 2u; // 1 texel halo on each side
const TILE_H : u32 = WGY + 2u;

// Per-kernel workgroup tiles at module scope
var<workgroup> normalTile  : array<array<f32, TILE_W>, TILE_H>;
var<workgroup> normal8Tile : array<array<f32, TILE_W>, TILE_H>;
var<workgroup> volumeTile  : array<array<f32, TILE_W>, TILE_H>;
var<workgroup> sphereTile  : array<array<f32, TILE_W>, TILE_H>;

// Height fetch 
fn sampleHeight(x: i32, y: i32, z: i32) -> f32 { if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(x, y, clampZ(z)), 0).x; } return textureLoad(inputTex, vec2<i32>(x, y), frame.layerIndex, 0).x; } fn safeNormalize(v: vec3<f32>) -> vec3<f32> { let len2 = dot(v, v); if (len2 > 1e-12) { return v * inverseSqrt(len2); } return vec3<f32>(0.0, 0.0, 1.0); }

@compute @workgroup_size(WGX, WGY, 1)
fn computeNormal(@builtin(global_invocation_id) gid: vec3<u32>,
                 @builtin(local_invocation_id)  lid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let wMax = i32(frame.fullWidth)  - 1;
  let hMax = i32(frame.fullHeight) - 1;

  let tx = i32(lid.x) + 1;
  let ty = i32(lid.y) + 1;

  let cx = clamp(fx, 0, wMax);
  let cy = clamp(fy, 0, hMax);

  // center
  normalTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);

  // 1-texel halo
  if (lid.x == 0u)               { normalTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }
  if (lid.x == WGX - 1u)         { normalTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }
  if (lid.y == 0u)               { normalTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }
  if (lid.y == WGY - 1u)         { normalTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }
  if (lid.x == 0u && lid.y == 0u) {
    normalTile[0u][0u]            = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == 0u) {
    normalTile[0u][TILE_W - 1u]   = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == 0u && lid.y == WGY - 1u) {
    normalTile[TILE_H - 1u][0u]   = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
    normalTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }

  workgroupBarrier();

  // 4-neighbor central differences
  let zC = normalTile[u32(ty)][u32(tx)];
  let zL = normalTile[u32(ty)][u32(tx - 1)];
  let zR = normalTile[u32(ty)][u32(tx + 1)];
  let zD = normalTile[u32(ty - 1)][u32(tx)];
  let zU = normalTile[u32(ty + 1)][u32(tx)];

  let dx = (zR - zL) * 0.5;
  let dy = (zU - zD) * 0.5;

  let n   = normalize(vec3<f32>(dx, dy, 1.0));
  let enc = n * 0.5 + vec3<f32>(0.5);

  // pack: .r = original height, .g = enc.y, .b = enc.x, .a = enc.z
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);
  storeRGBA(cx, cy, fz, outCol);
}

// 8-neighbor filtered gradient using the same tile
@compute @workgroup_size(WGX, WGY, 1)
fn computeNormal8(@builtin(global_invocation_id) gid: vec3<u32>,
                  @builtin(local_invocation_id)  lid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let wMax = i32(frame.fullWidth)  - 1;
  let hMax = i32(frame.fullHeight) - 1;

  let tx = i32(lid.x) + 1;
  let ty = i32(lid.y) + 1;

  let cx = clamp(fx, 0, wMax);
  let cy = clamp(fy, 0, hMax);

  // center
  normal8Tile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);

  // halo
  if (lid.x == 0u)                    { normal8Tile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }
  if (lid.x == WGX - 1u)              { normal8Tile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }
  if (lid.y == 0u)                    { normal8Tile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }
  if (lid.y == WGY - 1u)              { normal8Tile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }
  if (lid.x == 0u && lid.y == 0u)     { normal8Tile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }
  if (lid.x == WGX - 1u && lid.y == 0u) {
    normal8Tile[0u][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == 0u && lid.y == WGY - 1u) {
    normal8Tile[TILE_H - 1u][0u]      = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
    normal8Tile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }

  workgroupBarrier();

  let zC  = normal8Tile[u32(ty)][u32(tx)];
  let zL  = normal8Tile[u32(ty)][u32(tx - 1)];
  let zR  = normal8Tile[u32(ty)][u32(tx + 1)];
  let zD  = normal8Tile[u32(ty - 1)][u32(tx)];
  let zU  = normal8Tile[u32(ty + 1)][u32(tx)];
  let zUL = normal8Tile[u32(ty + 1)][u32(tx - 1)];
  let zUR = normal8Tile[u32(ty + 1)][u32(tx + 1)];
  let zDL = normal8Tile[u32(ty - 1)][u32(tx - 1)];
  let zDR = normal8Tile[u32(ty - 1)][u32(tx + 1)];

  let dx = ((zR + zUR + zDR) - (zL + zUL + zDL)) / 3.0;
  let dy = ((zU + zUR + zUL) - (zD + zDR + zDL)) / 3.0;

  let n   = normalize(vec3<f32>(dx, dy, 1.0));
  let enc = n * 0.5 + vec3<f32>(0.5);
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);
  storeRGBA(cx, cy, fz, outCol);
}

fn encode01(v: vec3<f32>) -> vec3<f32> {
    return v * 0.5 + vec3<f32>(0.5);
}

// Volume normals: tile the XY plane and only sample Z neighbors per pixel
@compute @workgroup_size(WGX, WGY, 1)
fn computeNormalVolume(@builtin(global_invocation_id) gid: vec3<u32>,
                       @builtin(local_invocation_id)  lid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let wMax = i32(frame.fullWidth)  - 1;
  let hMax = i32(frame.fullHeight) - 1;

  let tx = i32(lid.x) + 1;
  let ty = i32(lid.y) + 1;

  let cx = clamp(fx, 0, wMax);
  let cy = clamp(fy, 0, hMax);

  // center slice values once per tile
  volumeTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);
  if (lid.x == 0u)                    { volumeTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }
  if (lid.x == WGX - 1u)              { volumeTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }
  if (lid.y == 0u)                    { volumeTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }
  if (lid.y == WGY - 1u)              { volumeTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }
  if (lid.x == 0u && lid.y == 0u)     { volumeTile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }
  if (lid.x == WGX - 1u && lid.y == 0u) {
    volumeTile[0u][TILE_W - 1u]       = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == 0u && lid.y == WGY - 1u) {
    volumeTile[TILE_H - 1u][0u]       = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
    volumeTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }

  workgroupBarrier();

  let zC = volumeTile[u32(ty)][u32(tx)];
  let zL = volumeTile[u32(ty)][u32(tx - 1)];
  let zR = volumeTile[u32(ty)][u32(tx + 1)];
  let zD = volumeTile[u32(ty - 1)][u32(tx)];
  let zU = volumeTile[u32(ty + 1)][u32(tx)];

  let dx = (zR - zL) * 0.5;
  let dy = (zU - zD) * 0.5;

  let zB = sampleHeight(cx, cy, clampZ(fz - 1));
  let zF = sampleHeight(cx, cy, clampZ(fz + 1));
  let dz = (zF - zB) * 0.5;

  let n   = safeNormalize(vec3<f32>(dx, dy, dz));
  let enc = encode01(n);
  storeRGBA(cx, cy, fz, vec4<f32>(enc, zC));
}


// Sphere normals with shared tile and wrapped longitude
@compute @workgroup_size(WGX, WGY, 1)
fn computeSphereNormal(@builtin(global_invocation_id) gid: vec3<u32>,
                       @builtin(local_invocation_id)  lid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let w  = i32(frame.fullWidth);
    let h  = i32(frame.fullHeight);

    // wrap longitude, clamp latitude
    let wrapX  = ((fx % w) + w) % w;
    let clampY = clamp(fy, 0, h - 1);

    let tx = i32(lid.x) + 1;
    let ty = i32(lid.y) + 1;

    // center
    sphereTile[u32(ty)][u32(tx)] =
        textureLoad(inputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, 0).x;

    // halo
    if (lid.x == 0u) {
        let lx = ((wrapX - 1) % w + w) % w;
        sphereTile[u32(ty)][0u] =
            textureLoad(inputTex, vec2<i32>(lx, clampY), frame.layerIndex, 0).x;
    }
    if (lid.x == WGX - 1u) {
        let rx = ((wrapX + 1) % w + w) % w;
        sphereTile[u32(ty)][TILE_W - 1u] =
            textureLoad(inputTex, vec2<i32>(rx, clampY), frame.layerIndex, 0).x;
    }
    if (lid.y == 0u) {
        let dy = clamp(clampY - 1, 0, h - 1);
        sphereTile[0u][u32(tx)] =
            textureLoad(inputTex, vec2<i32>(wrapX, dy), frame.layerIndex, 0).x;
    }
    if (lid.y == WGY - 1u) {
        let uy = clamp(clampY + 1, 0, h - 1);
        sphereTile[TILE_H - 1u][u32(tx)] =
            textureLoad(inputTex, vec2<i32>(wrapX, uy), frame.layerIndex, 0).x;
    }
    // corners
    if (lid.x == 0u && lid.y == 0u) {
        let lx = ((wrapX - 1) % w + w) % w;
        let dy = clamp(clampY - 1, 0, h - 1);
        sphereTile[0u][0u] =
            textureLoad(inputTex, vec2<i32>(lx, dy), frame.layerIndex, 0).x;
    }
    if (lid.x == WGX - 1u && lid.y == 0u) {
        let rx = ((wrapX + 1) % w + w) % w;
        let dy = clamp(clampY - 1, 0, h - 1);
        sphereTile[0u][TILE_W - 1u] =
            textureLoad(inputTex, vec2<i32>(rx, dy), frame.layerIndex, 0).x;
    }
    if (lid.x == 0u && lid.y == WGY - 1u) {
        let lx = ((wrapX - 1) % w + w) % w;
        let uy = clamp(clampY + 1, 0, h - 1);
        sphereTile[TILE_H - 1u][0u] =
            textureLoad(inputTex, vec2<i32>(lx, uy), frame.layerIndex, 0).x;
    }
    if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
        let rx = ((wrapX + 1) % w + w) % w;
        let uy = clamp(clampY + 1, 0, h - 1);
        sphereTile[TILE_H - 1u][TILE_W - 1u] =
            textureLoad(inputTex, vec2<i32>(rx, uy), frame.layerIndex, 0).x;
    }

    workgroupBarrier();

    // fetch
    let baseH = sphereTile[u32(ty)][u32(tx)];
    let hL    = sphereTile[u32(ty)][u32(tx - 1)];
    let hR    = sphereTile[u32(ty)][u32(tx + 1)];
    let hD    = sphereTile[u32(ty - 1)][u32(tx)];
    let hU    = sphereTile[u32(ty + 1)][u32(tx)];

    // radii
    let r0 = options.baseRadius + baseH * options.heightScale;
    let rL = options.baseRadius + hL    * options.heightScale;
    let rR = options.baseRadius + hR    * options.heightScale;
    let rD = options.baseRadius + hD    * options.heightScale;
    let rU = options.baseRadius + hU    * options.heightScale;

    // spherical angles and increments
    let theta  = f32(clampY) / f32(h - 1) * PI;
    let phi    = f32(wrapX)  / f32(w - 1) * 2.0 * PI;
    let dTheta = PI / f32(h - 1);
    let dPhi   = 2.0 * PI / f32(w - 1);

    // precompute sines and cosines
    let sTh  = sin(theta);
    let cTh  = cos(theta);
    let sPh  = sin(phi);
    let cPh  = cos(phi);
    let sThU = sin(theta + dTheta);
    let cThU = cos(theta + dTheta);
    let sPhE = sin(phi + dPhi);
    let cPhE = cos(phi + dPhi);

    // positions on the sphere
    let p0 = vec3<f32>(r0 * sTh * cPh,
                       r0 * sTh * sPh,
                       r0 * cTh);

    let pE = vec3<f32>(rR * sTh * cPhE,
                       rR * sTh * sPhE,
                       rR * cTh);

    let pN = vec3<f32>(rU * sThU * cPh,
                       rU * sThU * sPh,
                       rU * cThU);

    // normal
    let tE = pE - p0;
    let tN = pN - p0;
    let n  = normalize(cross(tE, tN));
    let enc = n * 0.5 + vec3<f32>(0.5);

    // pack and store
    let outCol = vec4<f32>(baseH, enc.x, enc.y, enc.z);
    textureStore(outputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, outCol);
}


// Texture clear to reset channel(s)
@compute @workgroup_size(8, 8, 1)
fn clearTexture(@builtin(global_invocation_id) gid : vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  writeChannel(fx, fy, fz, 0.0, options.outputChannel, 1u);
}

// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014
// 0) Perlin
// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014
@compute @workgroup_size(8, 8, 1)
fn computePerlin(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of Perlin noise
    let v0 = generatePerlin(p, params);

    // add it into the selected channel (or all channels) of the output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 0.1) Perlin 4D (fBM using time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computePerlin4D(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel (w comes from params.time inside the generator)
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of 4D Perlin fBM (uses params.time as 4th dim)
    let v0 = generatePerlin4D(p, params);

    // write into output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 1) Billow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 2) AntiBillow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 3) Ridge
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidge(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidge(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 4) AntiRidge
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidge(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidge(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 5) RidgedMultifractal
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 6) RidgedMultifractal2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 7) RidgedMultifractal3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 8) RidgedMultifractal4
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal4(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 9) AntiRidgedMultifractal
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 10) AntiRidgedMultifractal2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 11) AntiRidgedMultifractal3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 12) AntiRidgedMultifractal4
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal4(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 13) FBM (2\xB7simplex chain)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFBM(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFBM(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 14) FBM2 (chain+zoom FBM)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFBM2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 15) FBM3 (three-stage FBM chain)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFBM3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 16) CellularBM1
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM1(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellularBM1(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 17) CellularBM2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellularBM2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 18) CellularBM3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellularBM3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 19) VoronoiBM1
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM1(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiBM1(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 20) VoronoiBM2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiBM2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 21) VoronoiBM3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiBM3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 22) Cellular
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellular(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellular(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  22.1) AntiCellular
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
@compute @workgroup_size(8, 8, 1)
fn computeAntiCellular(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiCellular(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 22.2) Cellular
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellular4D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  22.3) AntiCellular
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
@compute @workgroup_size(8, 8, 1)
fn computeAntiCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiCellular4D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 23) Worley
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWorley(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateWorley(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  23.1) AntiWorley
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
@compute @workgroup_size(8, 8, 1)
fn computeAntiWorley(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiWorley(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 23.2) Worley 4D (fBM using time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel (w comes from params.time inside the generator)
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)
    let v0 = generateWorley4D(p, params);

    // write into output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 23.3) Worley 4D (fBM using time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel (w comes from params.time inside the generator)
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)
    let v0 = generateAntiWorley4D(p, params);

    // write into output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Worley 4D BM variants (time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM1_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM2_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM3_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM1_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM2_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM3_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Cellular 4D BM variants (time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM1_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM2_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM3_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM1_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM2_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM3_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 24) VoronoiTileNoise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiTileNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiTileNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 25) LanczosBillow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeLanczosBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateLanczosBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 26) LanczosAntiBillow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeLanczosAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateLanczosAntiBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 27) Voronoi Circle-Gradient Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiCircleNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 28) Voronoi Circle-Gradient Tile Noise 2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircle2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiCircle2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 29) Voronoi Flat-Shade Tile Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiFlatShade(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiFlatShade(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 30) Voronoi Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiRipple3D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 31) Voronoi Ripple 3D 2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiRipple3D2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiRipple3D2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 32) Voronoi Circular Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiCircularRipple(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 33) Fractal Voronoi Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFVoronoiRipple3D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 34) Fractal Voronoi Circular Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFVoronoiCircularRipple(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 35) Ripple Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRippleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRippleNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 36) Fractal Ripples
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFractalRipples(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFractalRipples(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 37) HexWorms
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeHexWorms(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateHexWormsNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 38) PerlinWorms
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computePerlinWorms(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generatePerlinWormsNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 39) White Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWhiteNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateWhiteNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 40) Blue Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeBlueNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateBlueNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// 41) Simplex
@compute @workgroup_size(8,8,1)
fn computeSimplex(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  let v0 = generateSimplex(p, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeSimplexFBM(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  let v0 = generateSimplexFBM(p, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}


@compute @workgroup_size(8,8,1)
fn computeCurl2D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let pos = fetchPos(fx, fy, fz).xy;
  let v   = curl2_simplex2D(pos, params);
  // gentle gain so it doesn\u2019t clip hard; tweak 0.75 if you like
  let m   = mag_to_signed01(length(v) * 0.75);

  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeCurlFBM2D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let pos = fetchPos(fx, fy, fz).xy;
  let v   = curl2_simplexFBM(pos, params);
  let m   = mag_to_signed01(length(v) * 0.75);

  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeDomainWarpFBM1(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM1(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeDomainWarpFBM2(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM2(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeGaborAnisotropic(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateGaborAniso(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeGaborMagic(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateGaborMagic(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeTerraceNoise(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTerraceNoise(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeFoamNoise(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateFoamNoise(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeTurbulence(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTurbulence(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateAntiBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeLanczosBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateLanczosBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeLanczosAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateLanczosAntiBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeFBM4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateFBM4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeVoronoi4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoi4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeTerraceNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTerraceNoise4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeFoamNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateFoamNoise4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeTurbulence4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTurbulence4D(p, params), options.outputChannel, 0u);
}



// too slow to compile all at once due to branching, had to write new entry point logic
// fn computeMixedNoise(pos : vec3<f32>) -> f32 {
//     var result   : f32 = 0.0;
//     var paramIdx : u32 = 0u;

//     // copy the mask so we can eat bits out of it
//     var bits : u32 = options.mask;

//     // while there's still a set bit, handle just that one
//     loop {
//         // bail as soon as we've consumed all bits
//         if (bits == 0u) {
//             break;
//         }

//         // find the lowest set bit index
//         let i : u32 = firstTrailingBit(bits);

//         // clear that bit so next iteration finds the next one
//         bits = bits & (bits - 1u);

//         // load this algo's params
//         let p = params[paramIdx];
//         paramIdx = paramIdx + 1u;

//         // dispatch the one selected generator
//         var v : f32 = 0.0;
//         switch(i) {
//             case 0u:  { v = generatePerlin(pos, p); }
//             // case 1u:  { v = generateBillow(pos, p); }
//             // case 2u:  { v = generateAntiBillow(pos, p); }
//             // case 3u:  { v = generateRidge(pos, p); }
//             // case 4u:  { v = generateAntiRidge(pos, p); }
//             // case 5u:  { v = generateRidgedMultifractal(pos, p); }
//             // case 6u:  { v = generateRidgedMultifractal2(pos, p); }
//             // case 7u:  { v = generateRidgedMultifractal3(pos, p); }
//             // case 8u:  { v = generateRidgedMultifractal4(pos, p); }
//             // case 9u:  { v = generateAntiRidgedMultifractal(pos, p); }
//             // case 10u: { v = generateAntiRidgedMultifractal2(pos, p); }
//             // case 11u: { v = generateAntiRidgedMultifractal3(pos, p); }
//             // case 12u: { v = generateAntiRidgedMultifractal4(pos, p); }
//             // case 13u: { v = generateFBM(pos, p); }
//             // case 14u: { v = generateFBM2(pos, p); }
//             // case 15u: { v = generateFBM3(pos, p); }
//             // case 16u: { v = generateCellularBM1(pos, p); }
//             // case 17u: { v = generateCellularBM2(pos, p); }
//             // case 18u: { v = generateCellularBM3(pos, p); }
//             // case 19u: { v = generateVoronoiBM1(pos, p); }
//             // case 20u: { v = generateVoronoiBM2(pos, p); }
//             // case 21u: { v = generateVoronoiBM3(pos, p); }
//             // case 22u: { v = generateCellular(pos, p); }
//             // case 23u: { v = generateWorley(pos, p); }
//             // case 24u: { v = generateVoronoiTileNoise(pos, p); }
//             // case 25u: { v = generateLanczosBillow(pos, p); }
//             // case 26u: { v = generateLanczosAntiBillow(pos, p); }
//             //todo port the rest, also more generic ones like white/blue noise
//             default:  { /* unsupported bit \u2192 no contribution */ }
//         }

//         result = result + v;

//         // stop if we've reached the max slots you filled
//         if (paramIdx >= MAX_NOISE_CONFIGS) {
//             break;
//         }
//     }

//     return result;
// }

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Compute Entry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// @compute @workgroup_size(8, 8, 1)
// fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
//     // 2) compute absolute pixel coords in the full output
//     let fx = i32(frame.originX) + i32(gid.x);
//     let fy = i32(frame.originY) + i32(gid.y);
//     let p = fetchPos(fx, fy);

//     // 4) compute the mixed noise height
//     let h = computeMixedNoise(p);

//     // 5) (optional) finite-difference normal
//     var out: vec4<f32>;
//     if (options.getGradient == 1u) {
//         // let ex = options.epsilon.x;
//         // let ey = options.epsilon.y;
//         // let ez = options.epsilon.z;

//         // let hx = computeMixedNoise(p + vec3<f32>(ex, 0.0, 0.0));
//         // let lx = computeMixedNoise(p - vec3<f32>(ex, 0.0, 0.0));
//         // let hy = computeMixedNoise(p + vec3<f32>(0.0, ey, 0.0));
//         // let ly = computeMixedNoise(p - vec3<f32>(0.0, ey, 0.0));
//         // let hz = computeMixedNoise(p + vec3<f32>(0.0, 0.0, ez));
//         // let lz = computeMixedNoise(p - vec3<f32>(0.0, 0.0, ez));

//         // var dx = (hx - lx) / (2.0 * ex);
//         // var dy = (hy - ly) / (2.0 * ey);
//         // var dz = (hz - lz) / (2.0 * ez);
//         // let invLen = 1.0 / max(1e-6, sqrt(dx*dx + dy*dy + dz*dz));
//         // dx *= invLen; dy *= invLen; dz *= invLen;

//         // out = vec4<f32>(h, dx, dy, dz);
//     } else {
//         out = vec4<f32>(h, h, h, h);
//     }

//   // 6) write into the layer of the 2D-array texture
//   textureStore(
//     outputTex,
//     vec2<i32>(fx, fy),
//     frame.layerIndex,      
//     out
//   );
// }



// 5x5 Gaussian blur (separable weights via shared tile, single-pass)
// Applies per-channel convolution on RGBA and writes rgba16f
// If options.outputChannel == 0, writes all channels
// If 1..4, only that channel is replaced with blurred value, others copied from source

const WG_X : u32 = 16u;
const WG_Y : u32 = 16u;
const R    : u32 = 2u;        // kernel radius for 5x5
const TILE_SIZE : u32 = TILE_W * TILE_H;

const G5 : array<f32, 5> = array<f32,5>(1.0, 4.0, 6.0, 4.0, 1.0);
const G5NORM : f32 = 1.0 / 256.0;

var<workgroup> tileRGBA : array<vec4<f32>, TILE_SIZE>;

fn tileIndex(x: u32, y: u32)->u32 {
  return y * TILE_W + x;
}

@compute @workgroup_size(WG_X, WG_Y, 1)
fn computeGauss5x5(
  @builtin(local_invocation_id)  lid: vec3<u32>,
  @builtin(workgroup_id)         wid: vec3<u32>,
  @builtin(global_invocation_id) gid: vec3<u32>
){
  // Workgroup top-left in full image space
  let wgOx = i32(frame.originX) + i32(wid.x) * i32(WG_X);
  let wgOy = i32(frame.originY) + i32(wid.y) * i32(WG_Y);
  let fz   = i32(frame.originZ) + i32(gid.z);

  // Cooperatively load a (WG_X+4) x (WG_Y+4) tile with a 2px halo
  var ty: u32 = lid.y;
  loop {
    if (ty >= TILE_H) { break; }
    var tx: u32 = lid.x;
    loop {
      if (tx >= TILE_W) { break; }
      let sx = clamp(wgOx + i32(tx) - i32(R), 0, i32(frame.fullWidth)  - 1);
      let sy = clamp(wgOy + i32(ty) - i32(R), 0, i32(frame.fullHeight) - 1);
      tileRGBA[tileIndex(tx, ty)] = loadPrevRGBA(sx, sy, fz);
      tx += WG_X;
    }
    ty += WG_Y;
  }
  workgroupBarrier();

  // Output pixel this thread is responsible for
  let fx = wgOx + i32(lid.x);
  let fy = wgOy + i32(lid.y);

  // Guard writes that might fall off the image on the final groups
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  // Center within the shared tile
  let txc = u32(lid.x) + R;
  let tyc = u32(lid.y) + R;

  // 5x5 Gaussian using separable weights via outer product on the tile
  var acc : vec4<f32> = vec4<f32>(0.0);
  for (var j: u32 = 0u; j < 5u; j = j + 1u) {
    let wy = G5[j];
    let tyN = u32(i32(tyc) + i32(j) - 2);
    for (var i: u32 = 0u; i < 5u; i = i + 1u) {
      let wx = G5[i];
      let txN = u32(i32(txc) + i32(i) - 2);
      let w = (wx * wy) * G5NORM;
      acc += tileRGBA[tileIndex(txN, tyN)] * w;
    }
  }

  // Channel selection: 0 -> write all, 1..4 -> replace that channel only
  var outCol = acc;
  if (options.outputChannel != 0u) {
    let src = loadPrevRGBA(fx, fy, fz);
    let c = options.outputChannel;
    outCol = src;
    if (c == 1u) { outCol.x = acc.x; }
    else if (c == 2u) { outCol.y = acc.y; }
    else if (c == 3u) { outCol.z = acc.z; }
    else if (c == 4u) { outCol.w = acc.w; }
  }

  storeRGBA(fx, fy, fz, outCol);
}
`;var noiseBlit_default="// Fullscreen quad (module-scope constant)\r\nconst kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r\n  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r\n  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r\n);\r\n\r\nstruct VsOut {\r\n  @builtin(position) pos : vec4<f32>,\r\n  @location(0)       uv  : vec2<f32>,\r\n};\r\n\r\n@vertex\r\nfn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r\n  let p = kQuad[i];\r\n\r\n  var o : VsOut;\r\n  o.pos = vec4<f32>(p, 0.0, 1.0);\r\n  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r\n  return o;\r\n}\r\n\r\n@group(0) @binding(0) var samp : sampler;\r\n@group(0) @binding(1) var tex  : texture_2d_array<f32>;\r\n\r\nstruct UBlit2D {\r\n  layer   : u32,\r\n  channel : u32,\r\n  _pad0   : u32,\r\n  _pad1   : u32,\r\n};\r\n@group(0) @binding(2) var<uniform> U : UBlit2D;\r\n\r\n@fragment\r\nfn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r\n  // For array textures the signature is (tex, sampler, uv, arrayIndex, level)\r\n  let c = textureSampleLevel(tex, samp, in.uv, i32(U.layer), 0.0);\r\n\r\n  // display a single channel directly\r\n  var v = c.r;\r\n  if (U.channel == 2u) { v = c.g; }\r\n  if (U.channel == 3u) { v = c.b; }\r\n  if (U.channel == 4u) { v = c.a; }\r\n\r\n  return vec4<f32>(clamp(v, 0.0, 1.0));\r\n}\r\n";var noiseBlit3D_default="const kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r\n  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r\n  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r\n);\r\n\r\nstruct VsOut {\r\n  @builtin(position) pos : vec4<f32>,\r\n  @location(0)       uv  : vec2<f32>,\r\n};\r\n\r\n@vertex\r\nfn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r\n  let p = kQuad[i];\r\n  var o : VsOut;\r\n  o.pos = vec4<f32>(p, 0.0, 1.0);\r\n  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r\n  return o;\r\n}\r\n\r\n@group(0) @binding(0) var samp : sampler;\r\n@group(0) @binding(1) var tex3d : texture_3d<f32>;\r\n\r\nstruct UBlit3D {\r\n  zNorm   : f32,  // normalized depth [0..1]\r\n  channel : u32,\r\n  _pad0   : u32,\r\n  _pad1   : u32,\r\n};\r\n@group(0) @binding(2) var<uniform> U : UBlit3D;\r\n\r\n@fragment\r\nfn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r\n  let coord = vec3<f32>(in.uv, clamp(U.zNorm, 0.0, 1.0));\r\n  let c = textureSample(tex3d, samp, coord);\r\n\r\n  // display a single channel directly\r\n  var v = c.r;\r\n  if (U.channel == 2u) { v = c.g; }\r\n  if (U.channel == 3u) { v = c.b; }\r\n  if (U.channel == 4u) { v = c.a; }\r\n\r\n  return vec4<f32>(clamp(v, 0.0, 1.0));\r\n}\r\n";var MAX_2D_TILE=4096;var MAX_3D_TILE=2048;var BYTES_PER_VOXEL=8;var NoiseComputeBuilder=class{constructor(device,queue){this.device=device;this.queue=queue;this.maxBufferChunkBytes=8e6;this.entryPoints=["computePerlin","computeBillow","computeAntiBillow","computeRidge","computeAntiRidge","computeRidgedMultifractal","computeRidgedMultifractal2","computeRidgedMultifractal3","computeRidgedMultifractal4","computeAntiRidgedMultifractal","computeAntiRidgedMultifractal2","computeAntiRidgedMultifractal3","computeAntiRidgedMultifractal4","computeFBM","computeFBM2","computeFBM3","computeCellularBM1","computeCellularBM2","computeCellularBM3","computeVoronoiBM1","computeVoronoiBM2","computeVoronoiBM3","computeCellular","computeWorley","computeAntiCellular","computeAntiWorley","computeLanczosBillow","computeLanczosAntiBillow","computeVoronoiTileNoise","computeVoronoiCircleNoise","computeVoronoiCircle2","computeVoronoiFlatShade","computeVoronoiRipple3D","computeVoronoiRipple3D2","computeVoronoiCircularRipple","computeFVoronoiRipple3D","computeFVoronoiCircularRipple","computeRippleNoise","computeFractalRipples","computeHexWorms","computePerlinWorms","computeWhiteNoise","computeBlueNoise","computeSimplex","computeSimplexFBM","computeCurl2D","computeCurlFBM2D","computeDomainWarpFBM1","computeDomainWarpFBM2","computeGaborAnisotropic","computeGaborMagic","computeGaborFlow","computeTerraceNoise","computeFoamNoise","computeTurbulence","computePerlin4D","computeWorley4D","computeAntiWorley4D","computeCellular4D","computeAntiCellular4D","computeBillow4D","computeAntiBillow4D","computeLanczosBillow4D","computeLanczosAntiBillow4D","computeFBM4D","computeVoronoi4D","computeVoronoiBM1_4D","computeVoronoiBM2_4D","computeVoronoiBM3_4D","computeVoronoiBM1_4D_vec","computeVoronoiBM2_4D_vec","computeVoronoiBM3_4D_vec","computeWorleyBM1_4D","computeWorleyBM2_4D","computeWorleyBM3_4D","computeWorleyBM1_4D_vec","computeWorleyBM2_4D_vec","computeWorleyBM3_4D_vec","computeCellularBM1_4D","computeCellularBM2_4D","computeCellularBM3_4D","computeCellularBM1_4D_vec","computeCellularBM2_4D_vec","computeCellularBM3_4D_vec","computeTerraceNoise4D","computeFoamNoise4D","computeTurbulence4D","computeSmokeNoise","computeTerrainNoise","computeHydrologyErosionHeightfield","computeHydrologyGuideField","computeHydrologyDrainageMask","computeGauss5x5","computeNormal","computeNormal8","computeSphereNormal","computeNormalVolume","clearTexture"];this.shaderModule=device.createShaderModule({code:noiseCompute_default});this.bindGroupLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"2d-array"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:7,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"3d"}},{binding:8,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"3d"}}]});this.pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});this.pipelines=new Map;this._texPairs=new Map;this._tid=null;this._tag=new WeakMap;this._default2DKey="__default2d";this._volumeCache=new Map;this.viewA=null;this.viewB=null;this.width=0;this.height=0;this.layers=1;this.isA=true;this._initBuffers();this._ensureDummies();this._ctxMap=new WeakMap}_initBuffers(){this.optionsBuffer?.destroy();this.paramsBuffer?.destroy();this.permBuffer?.destroy();this.nullPosBuffer?.destroy();this.optionsBuffer=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.paramsBuffer=this.device.createBuffer({size:22*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.permBuffer=this.device.createBuffer({size:512*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.nullPosBuffer=this.device.createBuffer({size:64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.queue.writeBuffer(this.optionsBuffer,0,new ArrayBuffer(32));this.queue.writeBuffer(this.paramsBuffer,0,new ArrayBuffer(22*4));this.queue.writeBuffer(this.permBuffer,0,new Uint32Array(512))}_ensureDummies(){if(!this._dummy2D_sampleTex){this._dummy2D_sampleTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});this._dummy2D_sampleView=this._dummy2D_sampleTex.createView({dimension:"2d-array",arrayLayerCount:1})}if(!this._dummy2D_writeTex){this._dummy2D_writeTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST});this._dummy2D_writeView=this._dummy2D_writeTex.createView({dimension:"2d-array",arrayLayerCount:1})}if(!this._dummy3D_sampleTex){this._dummy3D_sampleTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});this._dummy3D_sampleView=this._dummy3D_sampleTex.createView({dimension:"3d"})}if(!this._dummy3D_writeTex){this._dummy3D_writeTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST});this._dummy3D_writeView=this._dummy3D_writeTex.createView({dimension:"3d"})}}_getMaxBufferChunkBytes(requested){const devMax=this.device?.limits?.maxBufferSize??256*1024*1024;const cap=Math.max(1024*1024,Math.floor(devMax*.9));let want=Number.isFinite(requested)?Math.floor(requested):this.maxBufferChunkBytes;if(!Number.isFinite(want)||want<=0)want=this.maxBufferChunkBytes;want=Math.max(4,want)&~3;return Math.min(cap,want)}_writeBufferChunked(dstBuffer,dstOffsetBytes,srcAB,srcOffsetBytes,byteLength,maxChunkBytes=null){const total=byteLength|0;if(!(total>0))return;const chunk=this._getMaxBufferChunkBytes(maxChunkBytes);let off=0;while(off<total){let n=Math.min(chunk,total-off)|0;n=n&~3;if(n<=0)break;this.queue.writeBuffer(dstBuffer,dstOffsetBytes+off|0,srcAB,srcOffsetBytes+off|0,n);off=off+n|0}if(off!==total){throw new Error(`_writeBufferChunked: incomplete write ${off}/${total} bytes`)}}async _readBGRA8TextureToRGBA8Pixels(texture,W,H,opts={}){const width=Math.max(1,W|0);const height=Math.max(1,H|0);const bytesPerPixel=4;const align=256;const bytesPerRowUnaligned=width*bytesPerPixel;const bytesPerRow=Math.ceil(bytesPerRowUnaligned/align)*align;const maxBuf=this.device?.limits?.maxBufferSize??256*1024*1024;const cap=Math.max(1024*1024,Math.floor(maxBuf*.9));let chunkBytes=this._getMaxBufferChunkBytes(opts.maxBufferChunkBytes);if(chunkBytes<bytesPerRow)chunkBytes=bytesPerRow;if(bytesPerRow>cap){throw new Error(`_readBGRA8TextureToRGBA8Pixels: bytesPerRow=${bytesPerRow} exceeds safe buffer cap=${cap}`)}const rowsPerChunk=Math.max(1,Math.floor(chunkBytes/bytesPerRow))|0;const pixels=new Uint8ClampedArray(width*height*4);const chunks=[];const encoder=this.device.createCommandEncoder();for(let y0=0;y0<height;y0+=rowsPerChunk){const rows=Math.min(rowsPerChunk,height-y0)|0;const bufSize=bytesPerRow*rows|0;const readBuffer=this.device.createBuffer({size:bufSize,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyTextureToBuffer({texture,origin:{x:0,y:y0,z:0}},{buffer:readBuffer,bytesPerRow,rowsPerImage:rows},{width,height:rows,depthOrArrayLayers:1});chunks.push({readBuffer,y0,rows})}this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}for(const ch of chunks){const{readBuffer,y0,rows}=ch;await readBuffer.mapAsync(GPUMapMode.READ);const mapped=readBuffer.getMappedRange();const src=new Uint8Array(mapped);for(let ry=0;ry<rows;ry++){const srcRow=ry*bytesPerRow;const dstRow=(y0+ry)*width*4;for(let x=0;x<width;x++){const si=srcRow+x*4;const di=dstRow+x*4;pixels[di+0]=src[si+2];pixels[di+1]=src[si+1];pixels[di+2]=src[si+0];pixels[di+3]=src[si+3]}}readBuffer.unmap();readBuffer.destroy()}return pixels}resize(maxConfigs){this.maxConfigs=maxConfigs;this._initBuffers()}setPermTable(permArray){this.queue.writeBuffer(this.permBuffer,0,permArray)}setPosBuffer(posBuffer){this.posBuffer=posBuffer}setInputTextureView(view){try{const usage=view?.texture?.usage??0;if((usage&GPUTextureUsage.TEXTURE_BINDING)===0){console.warn("setInputTextureView: provided texture view not created with TEXTURE_BINDING; ignoring.");return}}catch(e){}this.inputTextureView=view;if(this._tid!==null){const p=this._texPairs.get(this._tid);if(p)p.bindGroupDirty=true}}setOutputTextureView(view){try{const usage=view?.texture?.usage??0;if((usage&GPUTextureUsage.STORAGE_BINDING)===0){console.warn("setOutputTextureView: provided texture view not created with STORAGE_BINDING; ignoring.");return}}catch(e){}this.outputTextureView=view;if(this._tid!==null){const p=this._texPairs.get(this._tid);if(p)p.bindGroupDirty=true}}buildPermTable(seed=Date.now()){const noise=new BaseNoise(seed);const perm8=noise.perm;const perm32=new Uint32Array(512);for(let i=0;i<512;i++)perm32[i]=perm8[i];this.setPermTable(perm32)}setOptions(opts={}){if(Array.isArray(opts.noiseChoices)){this.noiseChoices=opts.noiseChoices}else if(!this.noiseChoices){this.noiseChoices=[0]}const{getGradient=0,outputChannel=1,baseRadius=0,heightScale=1,useCustomPos=0,ioFlags=0}=opts;this.useCustomPos=useCustomPos>>>0;const buf=new ArrayBuffer(32);const dv=new DataView(buf);dv.setUint32(0,getGradient,true);dv.setUint32(4,this.useCustomPos,true);dv.setUint32(8,outputChannel,true);dv.setUint32(12,ioFlags>>>0,true);dv.setFloat32(16,baseRadius,true);dv.setFloat32(20,heightScale,true);dv.setFloat32(24,0,true);dv.setFloat32(28,0,true);this.queue.writeBuffer(this.optionsBuffer,0,buf);for(const pair of this._texPairs.values())pair.bindGroupDirty=true}setNoiseParams(params={}){const p=params||{};const prev=this._lastNoiseParams||{};const has=Object.prototype.hasOwnProperty;const pickNum=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];const n=Number(v);if(Number.isFinite(n))return n;const fb=Number(fallback);return Number.isFinite(fb)?fb:0};const pickU32=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];const n=Number(v);if(Number.isFinite(n))return n>>>0;const fb=Number(fallback);return Number.isFinite(fb)?fb>>>0:0};const pickI32=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];const n=Number(v);if(Number.isFinite(n))return n|0;const fb=Number(fallback);return Number.isFinite(fb)?fb|0:0};const pickBoolU32=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];if(v===void 0)return(fallback?1:0)>>>0;return(v?1:0)>>>0};const seed=pickI32("seed",prev.seed??Date.now()|0);const zoomRaw=pickNum("zoom",prev.zoom??1);const freqRaw=pickNum("freq",prev.freq??1);const _zoom=Math.max(zoomRaw||0,1e-6);const _freq=Math.max(freqRaw||0,1e-6);const octaves=pickU32("octaves",prev.octaves??8);const turbulence=pickBoolU32("turbulence",prev.turbulence??0);const lacunarity=pickNum("lacunarity",prev.lacunarity??2);const gain=pickNum("gain",prev.gain??.5);const xShift=pickNum("xShift",prev.xShift??0);const yShift=pickNum("yShift",prev.yShift??0);const zShift=pickNum("zShift",prev.zShift??0);const seedAngle=pickNum("seedAngle",prev.seedAngle??0);const exp1=pickNum("exp1",prev.exp1??1);const exp2=pickNum("exp2",prev.exp2??0);const threshold=pickNum("threshold",prev.threshold??.1);const rippleFreq=pickNum("rippleFreq",prev.rippleFreq??10);const time=pickNum("time",prev.time??0);const warpAmp=pickNum("warpAmp",prev.warpAmp??.5);const gaborRadius=pickNum("gaborRadius",prev.gaborRadius??4);const terraceStep=pickNum("terraceStep",prev.terraceStep??8);const toroidal=pickBoolU32("toroidal",prev.toroidal??0);const voroMode=pickU32("voroMode",prev.voroMode??0);const edgeK=pickNum("edgeK",prev.edgeK??0);const buf=new ArrayBuffer(22*4);const dv=new DataView(buf);let base=0;dv.setUint32(base+0,seed>>>0,true);dv.setFloat32(base+4,_zoom,true);dv.setFloat32(base+8,_freq,true);dv.setUint32(base+12,octaves>>>0,true);dv.setFloat32(base+16,lacunarity,true);dv.setFloat32(base+20,gain,true);dv.setFloat32(base+24,xShift,true);dv.setFloat32(base+28,yShift,true);dv.setFloat32(base+32,zShift,true);dv.setUint32(base+36,turbulence>>>0,true);dv.setFloat32(base+40,seedAngle,true);dv.setFloat32(base+44,exp1,true);dv.setFloat32(base+48,exp2,true);dv.setFloat32(base+52,threshold,true);dv.setFloat32(base+56,rippleFreq,true);dv.setFloat32(base+60,time,true);dv.setFloat32(base+64,warpAmp,true);dv.setFloat32(base+68,gaborRadius,true);dv.setFloat32(base+72,terraceStep,true);dv.setUint32(base+76,toroidal>>>0,true);dv.setUint32(base+80,voroMode>>>0,true);dv.setFloat32(base+84,edgeK,true);this.queue.writeBuffer(this.paramsBuffer,0,buf);this._lastNoiseParams={seed,zoom:_zoom,freq:_freq,octaves,lacunarity,gain,xShift,yShift,zShift,turbulence,seedAngle,exp1,exp2,threshold,rippleFreq,time,warpAmp,gaborRadius,terraceStep,toroidal,voroMode,edgeK};for(const pair of this._texPairs.values())pair.bindGroupDirty=true;for(const[key,vol]of this._volumeCache){if(!vol||!Array.isArray(vol.chunks))continue;vol._bindGroupsDirty=true}}_numOr0(v){const n=Number(v);return Number.isFinite(n)?n:0}_resolveScroll2D(options,outW,outH,worldFullW,worldFullH,cropMode){const o=options||{};const outw=Math.max(1,outW|0);const outh=Math.max(1,outH|0);const fullw=Math.max(1,(worldFullW??outw)|0);const fullh=Math.max(1,(worldFullH??outh)|0);const w=cropMode?fullw:outw;const h=cropMode?fullh:outh;const offX=this._numOr0(o.offsetX)*w;const offY=this._numOr0(o.offsetY)*h;const baseXf=offX+this._numOr0(o.offsetXf)+this._numOr0(o.originXf)+this._numOr0(o.originX);const baseYf=offY+this._numOr0(o.offsetYf)+this._numOr0(o.originYf)+this._numOr0(o.originY);return{baseXf,baseYf}}_resolveScroll3D(options,outW,outH,outD){const o=options||{};const w=Math.max(1,outW|0);const h=Math.max(1,outH|0);const d=Math.max(1,outD|0);const offX=this._numOr0(o.offsetX)*w;const offY=this._numOr0(o.offsetY)*h;const offZ=this._numOr0(o.offsetZ)*d;const baseXf=offX+this._numOr0(o.offsetXf)+this._numOr0(o.originXf)+this._numOr0(o.originX);const baseYf=offY+this._numOr0(o.offsetYf)+this._numOr0(o.originYf)+this._numOr0(o.originY);const baseZf=offZ+this._numOr0(o.offsetZf)+this._numOr0(o.originZf)+this._numOr0(o.originZ);const baseZ=Math.floor(baseZf)|0;return{baseXf,baseYf,baseZ}}_update2DTileFrames(tid,options={}){const pair=this._texPairs.get(tid);if(!pair||!Array.isArray(pair.tiles)||pair.tiles.length===0)return;let worldFullW=Number.isFinite(options.frameFullWidth)?options.frameFullWidth>>>0:pair.fullWidth;let worldFullH=Number.isFinite(options.frameFullHeight)?options.frameFullHeight>>>0:pair.fullHeight;const cropMode=options.squareWorld||String(options.worldMode||"").toLowerCase()==="crop";if(options.squareWorld){const m=Math.max(worldFullW,worldFullH,pair.fullWidth,pair.fullHeight)>>>0;worldFullW=m;worldFullH=m}const outW=pair.fullWidth>>>0;const outH=pair.fullHeight>>>0;const{baseXf,baseYf}=this._resolveScroll2D(options,outW,outH,worldFullW,worldFullH,cropMode);const scaleX=cropMode?1:worldFullW/Math.max(1,outW);const scaleY=cropMode?1:worldFullH/Math.max(1,outH);for(const tile of pair.tiles){const fb=tile?.frames?.[0];if(!fb)continue;const ox=tile.originX|0;const oy=tile.originY|0;const worldX=(ox+baseXf)*scaleX;const worldY=(oy+baseYf)*scaleY;const originXf=worldFullW>0?worldX/worldFullW:0;const originYf=worldFullH>0?worldY/worldFullH:0;this._writeFrameUniform(fb,{fullWidth:worldFullW,fullHeight:worldFullH,tileWidth:pair.tileWidth,tileHeight:pair.tileHeight,originX:ox,originY:oy,originZ:0,fullDepth:1,tileDepth:1,layerIndex:tile.layerIndex|0,layers:pair.layers>>>0,originXf,originYf})}}_update3DChunkFrames(vol,worldFull=null,options={}){if(!vol||!Array.isArray(vol.chunks)||vol.chunks.length===0)return;const fw=worldFull&&Number.isFinite(worldFull?.w)?worldFull.w>>>0:vol.full.w;const fh=worldFull&&Number.isFinite(worldFull?.h)?worldFull.h>>>0:vol.full.h;const fd=worldFull&&Number.isFinite(worldFull?.d)?worldFull.d>>>0:vol.full.d;const outW=vol.full.w>>>0;const outH=vol.full.h>>>0;const outD=vol.full.d>>>0;const{baseXf,baseYf,baseZ}=this._resolveScroll3D(options,outW,outH,outD);const scaleX=fw/Math.max(1,outW);const scaleY=fh/Math.max(1,outH);for(const c of vol.chunks){if(!c.fb){c.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}const worldX=((c.ox|0)+baseXf)*scaleX;const worldY=((c.oy|0)+baseYf)*scaleY;const originXf=fw>0?worldX/fw:0;const originYf=fh>0?worldY/fh:0;const originZ=(c.oz|0)+baseZ|0;this._writeFrameUniform(c.fb,{fullWidth:fw,fullHeight:fh,tileWidth:c.w,tileHeight:c.h,originX:c.ox|0,originY:c.oy|0,originZ,fullDepth:fd,tileDepth:c.d,layerIndex:0,layers:1,originXf,originYf})}}_compute2DTiling(W,H){const tileW=Math.min(W,MAX_2D_TILE);const tileH=Math.min(H,MAX_2D_TILE);const tilesX=Math.ceil(W/tileW);const tilesY=Math.ceil(H/tileH);const layers=tilesX*tilesY;return{tileW,tileH,tilesX,tilesY,layers}}_create2DPair(W,H,tid=null){const t=this._compute2DTiling(W,H);const usage=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST;const makeTex=label=>this.device.createTexture({label,size:[t.tileW,t.tileH,t.layers],format:"rgba16float",usage});const desc={dimension:"2d-array",arrayLayerCount:t.layers};const id=tid!==null&&tid!==void 0?String(tid):String(this._texPairs.size);const texA=makeTex(`2D texA ${W}x${H}x${t.layers} (${id})`);const texB=makeTex(`2D texB ${W}x${H}x${t.layers} (${id})`);const viewA=texA.createView(desc);const viewB=texB.createView(desc);viewA.label=`2D:viewA (${id})`;viewB.label=`2D:viewB (${id})`;this._tag.set(viewA,`2D:A (${id})`);this._tag.set(viewB,`2D:B (${id})`);this._texPairs.set(id,{texA,texB,viewA,viewB,fullWidth:W,fullHeight:H,tileWidth:t.tileW,tileHeight:t.tileH,tilesX:t.tilesX,tilesY:t.tilesY,layers:t.layers,isA:true,tiles:null,bindGroupDirty:true});if(this._tid===null)this.setActiveTexture(id);return id}createShaderTextures(width,height){if(this._tid!==null&&this._texPairs.has(this._tid)){this.destroyTexturePair(this._tid)}const tid=this._create2DPair(width,height);this.setActiveTexture(tid);return tid}destroyTexturePair(tid){const id=String(tid);const pair=this._texPairs.get(id);if(!pair)return;try{pair.texA.destroy()}catch{}try{pair.texB.destroy()}catch{}if(Array.isArray(pair.tiles)){for(const tile of pair.tiles){if(Array.isArray(tile.frames)){for(const fb of tile.frames){try{fb.destroy()}catch{}}}if(tile.posBuf&&tile.posBuf!==this.nullPosBuffer){try{tile.posBuf.destroy()}catch{}}}}this._texPairs.delete(id);if(this._tid===id){this._tid=null;this.inputTextureView=null;this.outputTextureView=null;this.viewA=null;this.viewB=null}}destroyAllTexturePairs(){const ids=Array.from(this._texPairs.keys());for(const id of ids)this.destroyTexturePair(id)}setActiveTexture(tid){const id=String(tid);if(!this._texPairs.has(id))throw new Error("setActiveTexture: invalid id");this._tid=id;const pair=this._texPairs.get(id);this.viewA=pair.viewA;this.viewB=pair.viewB;this.width=pair.tileWidth;this.height=pair.tileHeight;this.layers=pair.layers;this.inputTextureView=pair.isA?pair.viewA:pair.viewB;this.outputTextureView=pair.isA?pair.viewB:pair.viewA}_buildPosBuffer(width,height,customData){if(!(customData instanceof Float32Array)||customData.byteLength<=0){return this.nullPosBuffer}const w=Math.max(1,Math.floor(width));const h=Math.max(1,Math.floor(height));const numPixels=w*h;const expectedLen=numPixels*4;if(customData.length!==expectedLen){throw new Error(`_buildPosBuffer: customData length ${customData.length} != expected ${expectedLen} (width=${w}, height=${h})`)}const devMax=this.device?.limits?.maxBufferSize??2147483648;const safeMax=Math.floor(devMax*.98);if(customData.byteLength>safeMax){throw new Error(`_buildPosBuffer: ${customData.byteLength} bytes exceeds maxBufferSize ${devMax} (w=${w}, h=${h})`)}const buf=this.device.createBuffer({size:customData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this._writeBufferChunked(buf,0,customData.buffer,customData.byteOffset,customData.byteLength,this.maxBufferChunkBytes);return buf}_writeFrameUniform(frameBuffer,f){const ab=new ArrayBuffer(64);const dv=new DataView(ab);dv.setUint32(0,f.fullWidth>>>0,true);dv.setUint32(4,f.fullHeight>>>0,true);dv.setUint32(8,f.tileWidth>>>0,true);dv.setUint32(12,f.tileHeight>>>0,true);dv.setInt32(16,f.originX|0,true);dv.setInt32(20,f.originY|0,true);dv.setInt32(24,f.originZ|0,true);dv.setUint32(28,f.fullDepth>>>0,true);dv.setUint32(32,f.tileDepth>>>0,true);dv.setInt32(36,f.layerIndex|0,true);dv.setUint32(40,f.layers>>>0,true);dv.setUint32(44,0,true);dv.setFloat32(48,f.originXf??0,true);dv.setFloat32(52,f.originYf??0,true);dv.setFloat32(56,0,true);dv.setFloat32(60,0,true);this.queue.writeBuffer(frameBuffer,0,ab)}_create2DTileBindGroups(tid,options={}){const pair=this._texPairs.get(tid);if(!pair)throw new Error("_create2DTileBindGroups: invalid tid");const wantsCustomPos=((options.useCustomPos??0)|0)!==0;const customData=wantsCustomPos&&options.customData instanceof Float32Array?options.customData:null;const hasCustomData=!!customData;const hadCustomBefore=Array.isArray(pair.tiles)&&pair.tiles.some(t=>t&&t.posIsCustom);if(!hasCustomData&&hadCustomBefore){pair.bindGroupDirty=true}if(Array.isArray(pair.tiles)&&!pair.bindGroupDirty&&!hasCustomData){return}const tiles=[];for(let ty=0;ty<pair.tilesY;ty++){for(let tx=0;tx<pair.tilesX;tx++){const layerIndex=ty*pair.tilesX+tx;const originX=tx*pair.tileWidth;const originY=ty*pair.tileHeight;const existingTile=pair.tiles&&pair.tiles[layerIndex]||null;let posBuf=this.nullPosBuffer;let posIsCustom=false;if(hasCustomData){posBuf=this._buildPosBuffer(pair.tileWidth,pair.tileHeight,customData);posIsCustom=posBuf!==this.nullPosBuffer}else if(existingTile&&existingTile.posBuf&&!existingTile.posIsCustom){posBuf=existingTile.posBuf;posIsCustom=false}else{posBuf=this.nullPosBuffer;posIsCustom=false;if(existingTile&&existingTile.posBuf&&existingTile.posIsCustom){try{existingTile.posBuf.destroy()}catch{}}}let fb;if(existingTile&&existingTile.frames&&existingTile.frames[0]){fb=existingTile.frames[0]}else{fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}let worldFullW=Number.isFinite(options.frameFullWidth)?options.frameFullWidth>>>0:pair.fullWidth;let worldFullH=Number.isFinite(options.frameFullHeight)?options.frameFullHeight>>>0:pair.fullHeight;const cropMode=options.squareWorld||String(options.worldMode||"").toLowerCase()==="crop";if(options.squareWorld){const m=Math.max(worldFullW,worldFullH,pair.fullWidth,pair.fullHeight)>>>0;worldFullW=m;worldFullH=m}let originXf,originYf;if(cropMode){originXf=originX;originYf=originY}else{const scaleX=worldFullW/pair.fullWidth;const scaleY=worldFullH/pair.fullHeight;originXf=originX*scaleX;originYf=originY*scaleY}this._writeFrameUniform(fb,{fullWidth:worldFullW,fullHeight:worldFullH,tileWidth:pair.tileWidth,tileHeight:pair.tileHeight,originX,originY,originZ:0,fullDepth:1,tileDepth:1,layerIndex,layers:pair.layers,originXf,originYf});let bgA=existingTile?.bgs?.[0]?.bgA??null;let bgB=existingTile?.bgs?.[0]?.bgB??null;if(!bgA||!bgB||pair.bindGroupDirty){bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:pair.viewA},{binding:4,resource:pair.viewB},{binding:5,resource:{buffer:posBuf}},{binding:6,resource:{buffer:fb}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]});bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:pair.viewB},{binding:4,resource:pair.viewA},{binding:5,resource:{buffer:posBuf}},{binding:6,resource:{buffer:fb}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]})}tiles.push({layerIndex,originX,originY,frames:[fb],posBuf,posIsCustom,bgs:[{bgA,bgB}]})}}pair.tiles=tiles;pair.bindGroupDirty=false;if(this._tid===tid)this._tiles=tiles}async _runPipelines(bgA,bgB,tileW,tileH,tileD,paramsArray,dispatchZ=1){let current=bgA;let alternate=bgB;const isArr=Array.isArray(paramsArray);let i=0;const enc=this.device.createCommandEncoder();const pass=enc.beginComputePass();for(const choice of this.noiseChoices){const entry=typeof choice==="number"?this.entryPoints[choice]:choice;let pipe=this.pipelines.get(entry);if(!pipe){pipe=this.device.createComputePipeline({layout:this.pipelineLayout,compute:{module:this.shaderModule,entryPoint:entry}});this.pipelines.set(entry,pipe)}if(isArr)this.setNoiseParams(paramsArray[i++]);pass.setPipeline(pipe);pass.setBindGroup(0,current);pass.dispatchWorkgroups(Math.ceil(tileW/8),Math.ceil(tileH/8),dispatchZ);[current,alternate]=[alternate,current]}pass.end();this.queue.submit([enc.finish()]);return alternate}async computeToTexture(width,height,paramsObj={},options={}){const W=width|0;const H=height|0;if(!(W>0&&H>0)){throw new Error(`computeToTexture: invalid size ${width}x${height}`)}const key=this._get2DKey(options);const existing=this._texPairs.get(key);if(!existing){this._create2DPair(W,H,key)}else if(existing.fullWidth!==W||existing.fullHeight!==H){this.destroyTexturePair(key);this._create2DPair(W,H,key)}this.setActiveTexture(key);const pair=this._texPairs.get(key);if(!pair)throw new Error("computeToTexture: missing pair after ensure");if(paramsObj&&!Array.isArray(paramsObj))this.setNoiseParams(paramsObj);const origOpts=options||{};const wantsCustomPos=((origOpts.useCustomPos??0)|0)!==0;const customData=wantsCustomPos&&origOpts.customData instanceof Float32Array?origOpts.customData:null;const useCustomPos=customData?1:0;this.setOptions({...origOpts,ioFlags:0,useCustomPos});const tileOpts={...origOpts,useCustomPos,customData};if(!pair.tiles||pair.bindGroupDirty||!!customData){this._create2DTileBindGroups(key,tileOpts)}this._update2DTileFrames(key,tileOpts);const isAStart=pair.isA;let finalUsed=null;let lastBGs=null;for(const tile of pair.tiles){const{bgA,bgB}=tile.bgs[0];const start=!finalUsed?isAStart?bgA:bgB:finalUsed===bgA?bgA:bgB;const alt=start===bgA?bgB:bgA;finalUsed=await this._runPipelines(start,alt,pair.tileWidth,pair.tileHeight,1,paramsObj,1);lastBGs={bgA,bgB}}const resultsInA=finalUsed===lastBGs.bgB;pair.isA=resultsInA;this.setActiveTexture(key);return this.getCurrentView(key)}_get2DKey(options){const k=options&&options.textureKey!==void 0&&options.textureKey!==null?String(options.textureKey):"";return k&&k.length?k:this._default2DKey}get2DView(key){const id=String(key);const p=this._texPairs.get(id);if(!p)return null;return p.isA?p.viewA:p.viewB}getCurrentView(tid=null){const id=tid!==null&&tid!==void 0?String(tid):this._tid;const p=this._texPairs.get(id);if(!p)return null;return p.isA?p.viewA:p.viewB}getCurrentTextureResource(tid=null){const id=tid!==null&&tid!==void 0?String(tid):this._tid;const p=this._texPairs.get(id);if(!p)return null;return{texture:p.isA?p.texA:p.texB,view:p.isA?p.viewA:p.viewB,width:p.fullWidth,height:p.fullHeight,layers:p.layers,format:"rgba16float"}}_compute3DTiling(W,H,D){const tw=Math.min(W,MAX_3D_TILE);const th=Math.min(H,MAX_3D_TILE);const maxBuf=this.device?.limits?.maxBufferSize??256*1024*1024;const sliceBytes=tw*th*BYTES_PER_VOXEL;const tdByBuf=Math.max(1,Math.floor(maxBuf*.8/Math.max(1,sliceBytes)));const td=Math.min(D,MAX_3D_TILE,tdByBuf);const nx=Math.ceil(W/tw);const ny=Math.ceil(H/th);const nz=Math.ceil(D/td);return{tw,th,td,nx,ny,nz}}_create3DChunks(W,H,D){const t=this._compute3DTiling(W,H,D);const chunks=[];const usage3D=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST;for(let kz=0;kz<t.nz;kz++){for(let ky=0;ky<t.ny;ky++){for(let kx=0;kx<t.nx;kx++){const ox=kx*t.tw;const oy=ky*t.th;const oz=kz*t.td;const texA=this.device.createTexture({size:{width:t.tw,height:t.th,depthOrArrayLayers:t.td},dimension:"3d",format:"rgba16float",usage:usage3D});const texB=this.device.createTexture({size:{width:t.tw,height:t.th,depthOrArrayLayers:t.td},dimension:"3d",format:"rgba16float",usage:usage3D});const viewA=texA.createView({dimension:"3d"});const viewB=texB.createView({dimension:"3d"});texA.label=`3D texA ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;texB.label=`3D texB ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;viewA.label=`3D:viewA[${kx},${ky},${kz}]`;viewB.label=`3D:viewB[${kx},${ky},${kz}]`;this._tag.set(viewA,`3D:A[${kx},${ky},${kz}]`);this._tag.set(viewB,`3D:B[${kx},${ky},${kz}]`);chunks.push({texA,texB,viewA,viewB,ox,oy,oz,w:t.tw,h:t.th,d:t.td,isA:true,fb:null,posBuf:null,bgA:null,bgB:null})}}}return{chunks,tile:{w:t.tw,h:t.th,d:t.td},full:{w:W,h:H,d:D},grid:{nx:t.nx,ny:t.ny,nz:t.nz}}}_destroy3DSet(vol){if(!vol)return;for(const c of vol.chunks){try{c.texA.destroy()}catch{}try{c.texB.destroy()}catch{}c.viewA=null;c.viewB=null;c.bgA=null;c.bgB=null;if(c.fb){try{c.fb.destroy()}catch{}c.fb=null}if(c.posBuf&&c.posBuf!==this.nullPosBuffer){try{c.posBuf.destroy()}catch{}c.posBuf=null}}}destroyAllVolumes(){for(const[k,v]of this._volumeCache){this._destroy3DSet(v);this._volumeCache.delete(k)}}get3DView(id){const vol=this._volumeCache.get(String(id));if(!vol)return null;const views=vol.chunks.map(c=>c.isA?c.viewA:c.viewB);return views.length===1?views[0]:{views,meta:{full:vol.full,tile:vol.tile,grid:vol.grid}}}destroyVolume(id){const key=String(id);const vol=this._volumeCache.get(key);if(!vol)return;this._destroy3DSet(vol);this._volumeCache.delete(key)}_getOrCreate3DVolume(W,H,D,id=null,worldFull=null){const key=id?String(id):`${W}x${H}x${D}`;let vol=this._volumeCache.get(key);if(vol)return vol;vol=this._create3DChunks(W,H,D);for(const c of vol.chunks){c.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const fw=worldFull&&Number.isFinite(worldFull?.w)?worldFull.w>>>0:vol.full.w;const fh=worldFull&&Number.isFinite(worldFull?.h)?worldFull.h>>>0:vol.full.h;const fd=worldFull&&Number.isFinite(worldFull?.d)?worldFull.d>>>0:vol.full.d;const scaleX=fw/vol.full.w;const scaleY=fh/vol.full.h;const originXf=c.ox*scaleX;const originYf=c.oy*scaleY;this._writeFrameUniform(c.fb,{fullWidth:fw,fullHeight:fh,tileWidth:c.w,tileHeight:c.h,originX:c.ox,originY:c.oy,originZ:c.oz,fullDepth:fd,tileDepth:c.d,layerIndex:0,layers:1,originXf,originYf});const posBuf=this._buildPosBuffer(c.w,c.h,null);c.posBuf=posBuf;try{c.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewA},{binding:8,resource:c.viewB}]});c.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:c.posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewB},{binding:8,resource:c.viewA}]})}catch(e){throw new Error(`_getOrCreate3DVolume: createBindGroup failed: ${e?.message||e}`)}}vol._bindGroupsDirty=false;this._volumeCache.set(key,vol);return vol}_recreate3DBindGroups(vol,worldFull=null){if(!vol||!Array.isArray(vol.chunks))return;const fw=worldFull&&Number.isFinite(worldFull.w)?worldFull.w>>>0:vol.full.w;const fh=worldFull&&Number.isFinite(worldFull.h)?worldFull.h>>>0:vol.full.h;const fd=worldFull&&Number.isFinite(worldFull.d)?worldFull.d>>>0:vol.full.d;for(const c of vol.chunks){if(!c.fb){c.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const scaleX=fw/vol.full.w;const scaleY=fh/vol.full.h;const originXf=c.ox*scaleX;const originYf=c.oy*scaleY;this._writeFrameUniform(c.fb,{fullWidth:fw,fullHeight:fh,tileWidth:c.w,tileHeight:c.h,originX:c.ox,originY:c.oy,originZ:c.oz,fullDepth:fd,tileDepth:c.d,layerIndex:0,layers:1,originXf,originYf})}if(!c.posBuf){c.posBuf=this._buildPosBuffer(c.w,c.h,null)}const entriesA=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:c.posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewA},{binding:8,resource:c.viewB}];const entriesB=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:c.posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewB},{binding:8,resource:c.viewA}];try{c.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:entriesA});c.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:entriesB})}catch(e){throw new Error(`_recreate3DBindGroups: failed to create bind groups: ${e?.message||e}`)}}vol._bindGroupsDirty=false}async computeToTexture3D(width,height,depth,paramsObj={},options={}){const W=width|0,H=height|0,D=depth|0;if(!(W>0&&H>0&&D>0))throw new Error(`computeToTexture3D: invalid size ${width}x${height}x${depth}`);if(paramsObj&&!Array.isArray(paramsObj))this.setNoiseParams(paramsObj);const origOpts=options||{};this.setOptions({...origOpts,ioFlags:3,useCustomPos:origOpts.useCustomPos??this.useCustomPos});const worldFull=(()=>{if(options&&(Number.isFinite(options.frameFullWidth)||Number.isFinite(options.frameFullHeight)||Number.isFinite(options.frameFullDepth))){return{w:Number.isFinite(options.frameFullWidth)?options.frameFullWidth>>>0:W,h:Number.isFinite(options.frameFullHeight)?options.frameFullHeight>>>0:H,d:Number.isFinite(options.frameFullDepth)?options.frameFullDepth>>>0:D}}return null})();const vol=this._getOrCreate3DVolume(W,H,D,options.id,worldFull);if(!vol)throw new Error("computeToTexture3D: failed to create or retrieve volume");if(vol._bindGroupsDirty||!vol.chunks[0].bgA||!vol.chunks[0].bgB){this._recreate3DBindGroups(vol,worldFull)}this._update3DChunkFrames(vol,worldFull,options);let lastBG=null;for(const c of vol.chunks){const start=c.isA?c.bgA:c.bgB;const alt=c.isA?c.bgB:c.bgA;if(!start||!alt){throw new Error("computeToTexture3D: missing bind groups (volume not initialized correctly)")}lastBG=await this._runPipelines(start,alt,c.w,c.h,c.d,paramsObj,c.d);c.isA=lastBG===c.bgB}const views=vol.chunks.map(c=>c.isA?c.viewA:c.viewB);return views.length===1?views[0]:{views,meta:{full:vol.full,tile:vol.tile,grid:vol.grid}}}configureCanvas(canvas){const format=navigator.gpu.getPreferredCanvasFormat&&navigator.gpu.getPreferredCanvasFormat()||"bgra8unorm";const ctx=canvas.getContext("webgpu");ctx.configure({device:this.device,format,alphaMode:"opaque",size:[canvas.width,canvas.height]});this._ctxMap.set(canvas,{ctx,size:[canvas.width,canvas.height]})}initBlitRender(){if(!this.sampler){this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}if(!this.bgl2D){this.bgl2D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});this.pipeline2D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl2D]}),vertex:{module:this.device.createShaderModule({code:noiseBlit_default}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:noiseBlit_default}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}});this.blit2DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}if(!this.bgl3D){this.bgl3D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"3d"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});this.pipeline3D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl3D]}),vertex:{module:this.device.createShaderModule({code:noiseBlit3D_default}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:noiseBlit3D_default}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}});this.blit3DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}}_renderCommonCanvasSetup(canvas,clear){const format="bgra8unorm";let entry=this._ctxMap.get(canvas);if(!entry){const ctx=canvas.getContext("webgpu");const size=[canvas.width|0,canvas.height|0];ctx.configure({device:this.device,format,alphaMode:"opaque",size});entry={ctx,size};this._ctxMap.set(canvas,entry)}else{const curW=canvas.width|0,curH=canvas.height|0;if(entry.size[0]!==curW||entry.size[1]!==curH){entry.size=[curW,curH];entry.ctx.configure({device:this.device,format,alphaMode:"opaque",size:entry.size})}}const enc=this.device.createCommandEncoder();const pass=enc.beginRenderPass({colorAttachments:[{view:entry.ctx.getCurrentTexture().createView(),loadOp:clear?"clear":"load",clearValue:{r:0,g:0,b:0,a:1},storeOp:"store"}]});return{enc,pass,ctxEntry:entry}}renderTextureToCanvas(textureView,canvas,opts={}){const{layer=0,channel=0,preserveCanvasSize=true,clear=true}=opts;this.initBlitRender();if(!preserveCanvasSize){try{const tex=textureView.texture;if(tex&&typeof tex.width==="number"&&typeof tex.height==="number"){canvas.width=tex.width;canvas.height=tex.height}}catch{}}const u=new Uint32Array([layer>>>0,channel>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,u.buffer,u.byteOffset,u.byteLength);const bg=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:textureView},{binding:2,resource:{buffer:this.blit2DUbo}}]});const{enc,pass}=this._renderCommonCanvasSetup(canvas,clear);pass.setPipeline(this.pipeline2D);pass.setBindGroup(0,bg);pass.draw(6,1,0,0);pass.end();this.queue.submit([enc.finish()])}renderTexture3DSliceToCanvas(target,canvas,opts={}){const{depth,slice=0,zNorm=null,channel=0,chunk=0,preserveCanvasSize=true,clear=true}=opts;this.initBlitRender();let view3D,d;if(target&&target.views&&Array.isArray(target.views)){view3D=target.views[Math.max(0,Math.min(chunk|0,target.views.length-1))];d=target.meta?.tile?.d??depth}else{view3D=target;d=depth}if(!view3D||!d)throw new Error("renderTexture3DSliceToCanvas: need a 3D view and its depth");if(!preserveCanvasSize){try{const tex=view3D.texture;if(tex&&typeof tex.width==="number"&&typeof tex.height==="number"){canvas.width=tex.width;canvas.height=tex.height}}catch{}}let z=zNorm!==null&&zNorm!==void 0?zNorm:(Math.min(Math.max(slice,0),d-1)+.5)/d;z=Math.min(Math.max(z,0),1);const ab=new ArrayBuffer(16);const dv=new DataView(ab);dv.setFloat32(0,z,true);dv.setUint32(4,channel>>>0,true);dv.setUint32(8,0,true);dv.setUint32(12,0,true);this.queue.writeBuffer(this.blit3DUbo,0,ab);const bg=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:view3D},{binding:2,resource:{buffer:this.blit3DUbo}}]});const{enc,pass}=this._renderCommonCanvasSetup(canvas,clear);pass.setPipeline(this.pipeline3D);pass.setBindGroup(0,bg);pass.draw(6,1,0,0);pass.end();this.queue.submit([enc.finish()])}setExportBackground(background="black"){this.exportBackground=background}_resolveExportBackground(background){const bg=background===void 0?this.exportBackground:background;if(bg==null)return{r:0,g:0,b:0,a:1,transparent:false};if(typeof bg==="string"){const s=bg.trim().toLowerCase();if(s==="transparent")return{r:0,g:0,b:0,a:0,transparent:true};if(s==="black")return{r:0,g:0,b:0,a:1,transparent:false};if(s==="white")return{r:1,g:1,b:1,a:1,transparent:false};if(s[0]==="#")return this._parseHexBackground(s)}const norm01=v=>{const n=Number(v);if(!Number.isFinite(n))return 0;const x=n>1?n/255:n;return Math.min(Math.max(x,0),1)};if(Array.isArray(bg)){const r=norm01(bg[0]);const g=norm01(bg[1]);const b=norm01(bg[2]);const a=bg.length>=4?norm01(bg[3]):1;return{r,g,b,a,transparent:a<=0}}if(typeof bg==="object"){const r=norm01(bg.r);const g=norm01(bg.g);const b=norm01(bg.b);const a=bg.a===void 0?1:norm01(bg.a);return{r,g,b,a,transparent:a<=0}}return{r:0,g:0,b:0,a:1,transparent:false}}_parseHexBackground(hex){const h=String(hex).trim().replace(/^#/,"");const expand=c=>c+c;let r=0,g=0,b=0,a=255;if(h.length===3||h.length===4){r=parseInt(expand(h[0]),16);g=parseInt(expand(h[1]),16);b=parseInt(expand(h[2]),16);if(h.length===4)a=parseInt(expand(h[3]),16)}else if(h.length===6||h.length===8){r=parseInt(h.slice(0,2),16);g=parseInt(h.slice(2,4),16);b=parseInt(h.slice(4,6),16);if(h.length===8)a=parseInt(h.slice(6,8),16)}else{return{r:0,g:0,b:0,a:1,transparent:false}}const rf=r/255;const gf=g/255;const bf=b/255;const af=a/255;return{r:rf,g:gf,b:bf,a:af,transparent:af<=0}}_applyExportBackground(pixelsRGBA,bg){if(!pixelsRGBA||!bg||bg.transparent)return;const br=Math.round(bg.r*255);const bgc=Math.round(bg.g*255);const bb=Math.round(bg.b*255);const ba=Math.round((bg.a??1)*255);if(ba<=0)return;const n=pixelsRGBA.length|0;if(ba>=255){for(let i=0;i<n;i+=4){const a=pixelsRGBA[i+3]|0;if(a===255)continue;if(a===0){pixelsRGBA[i+0]=br;pixelsRGBA[i+1]=bgc;pixelsRGBA[i+2]=bb;pixelsRGBA[i+3]=255;continue}const ia=255-a;pixelsRGBA[i+0]=(pixelsRGBA[i+0]*a+br*ia)/255|0;pixelsRGBA[i+1]=(pixelsRGBA[i+1]*a+bgc*ia)/255|0;pixelsRGBA[i+2]=(pixelsRGBA[i+2]*a+bb*ia)/255|0;pixelsRGBA[i+3]=255}return}for(let i=0;i<n;i+=4){const fr=pixelsRGBA[i+0]|0;const fg=pixelsRGBA[i+1]|0;const fb=pixelsRGBA[i+2]|0;const fa=pixelsRGBA[i+3]|0;const outA=fa+ba*(255-fa)/255|0;if(outA<=0){pixelsRGBA[i+0]=0;pixelsRGBA[i+1]=0;pixelsRGBA[i+2]=0;pixelsRGBA[i+3]=0;continue}const brp=br*ba|0;const bgp=bgc*ba|0;const bbp=bb*ba|0;const frp=fr*fa|0;const fgp=fg*fa|0;const fbp=fb*fa|0;const bgScale=255-fa|0;const outRp=frp+brp*bgScale/255|0;const outGp=fgp+bgp*bgScale/255|0;const outBp=fbp+bbp*bgScale/255|0;pixelsRGBA[i+0]=Math.min(255,Math.max(0,outRp*255/outA|0));pixelsRGBA[i+1]=Math.min(255,Math.max(0,outGp*255/outA|0));pixelsRGBA[i+2]=Math.min(255,Math.max(0,outBp*255/outA|0));pixelsRGBA[i+3]=Math.min(255,Math.max(0,outA))}}_forceOpaqueAlpha(pixelsRGBA){const n=pixelsRGBA.length|0;for(let i=3;i<n;i+=4)pixelsRGBA[i]=255}async export2DTextureToPNGBlob(textureView,width,height,opts={}){if(!textureView){throw new Error("export2DTextureToPNGBlob: textureView is required")}const W=Math.max(1,width|0);const H=Math.max(1,height|0);const layer=opts.layer??0;const channel=opts.channel??0;const bgSpec=this._resolveExportBackground(opts.background);this.initBlitRender();if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}const format="bgra8unorm";const captureTexture=this.device.createTexture({size:[W,H,1],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});const u=new Uint32Array([layer>>>0,channel>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,u.buffer,u.byteOffset,u.byteLength);const bg=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:textureView},{binding:2,resource:{buffer:this.blit2DUbo}}]});const encoder=this.device.createCommandEncoder();const rpass=encoder.beginRenderPass({colorAttachments:[{view:captureTexture.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});rpass.setPipeline(this.pipeline2D);rpass.setBindGroup(0,bg);rpass.draw(6,1,0,0);rpass.end();this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}const pixels=await this._readBGRA8TextureToRGBA8Pixels(captureTexture,W,H,{maxBufferChunkBytes:opts.maxBufferChunkBytes??this.maxBufferChunkBytes});captureTexture.destroy();const useAlphaForBackground=opts.useAlphaForBackground===true;if(bgSpec.transparent||useAlphaForBackground){this._applyExportBackground(pixels,bgSpec)}else{this._forceOpaqueAlpha(pixels)}const tmpCanvas=document.createElement("canvas");tmpCanvas.width=W;tmpCanvas.height=H;const ctx2d=tmpCanvas.getContext("2d");if(!ctx2d){throw new Error("export2DTextureToPNGBlob: unable to get 2D context")}ctx2d.putImageData(new ImageData(pixels,W,H),0,0);const blob=await new Promise((resolve,reject)=>{tmpCanvas.toBlob(b=>{if(b)resolve(b);else reject(new Error("export2DTextureToPNGBlob: toBlob returned null"))},"image/png")});return blob}async exportCurrent2DToPNGBlob(width,height,opts={}){const view=this.getCurrentView();if(!view){throw new Error("exportCurrent2DToPNGBlob: no active 2D texture view")}return this.export2DTextureToPNGBlob(view,width,height,opts)}async export3DSliceToPNGBlob(target,width,height,opts={}){if(!target){throw new Error("export3DSliceToPNGBlob: target is required")}const W=Math.max(1,width|0);const H=Math.max(1,height|0);const{depth,slice=0,zNorm=null,channel=0,chunk=0}=opts;if(!depth||depth<=0){throw new Error("export3DSliceToPNGBlob: depth must be provided and > 0")}const bgSpec=this._resolveExportBackground(opts.background);this.initBlitRender();if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}let view3D;let d;if(target&&target.views&&Array.isArray(target.views)){const idx=Math.max(0,Math.min(chunk|0,target.views.length-1));view3D=target.views[idx];d=target.meta?.tile?.d??depth}else{view3D=target;d=depth}if(!view3D||!d){throw new Error("export3DSliceToPNGBlob: need a 3D view and its depth")}let z=zNorm!==null&&zNorm!==void 0?zNorm:(Math.min(Math.max(slice,0),d-1)+.5)/d;z=Math.min(Math.max(z,0),1);const format="bgra8unorm";const captureTexture=this.device.createTexture({size:[W,H,1],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});const ab=new ArrayBuffer(16);const dv=new DataView(ab);dv.setFloat32(0,z,true);dv.setUint32(4,channel>>>0,true);dv.setUint32(8,0,true);dv.setUint32(12,0,true);this.queue.writeBuffer(this.blit3DUbo,0,ab);const bg=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:view3D},{binding:2,resource:{buffer:this.blit3DUbo}}]});const encoder=this.device.createCommandEncoder();const rpass=encoder.beginRenderPass({colorAttachments:[{view:captureTexture.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});rpass.setPipeline(this.pipeline3D);rpass.setBindGroup(0,bg);rpass.draw(6,1,0,0);rpass.end();const bytesPerPixel=4;const align=256;const bytesPerRowUnaligned=W*bytesPerPixel;const bytesPerRow=Math.ceil(bytesPerRowUnaligned/align)*align;const bufferSize=bytesPerRow*H;const readBuffer=this.device.createBuffer({size:bufferSize,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyTextureToBuffer({texture:captureTexture},{buffer:readBuffer,bytesPerRow,rowsPerImage:H},{width:W,height:H,depthOrArrayLayers:1});this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){await this.queue.onSubmittedWorkDone()}await readBuffer.mapAsync(GPUMapMode.READ);const mapped=readBuffer.getMappedRange();const src=new Uint8Array(mapped);const pixels=new Uint8ClampedArray(W*H*bytesPerPixel);let dst=0;for(let y=0;y<H;y++){const rowStart=y*bytesPerRow;for(let x=0;x<W;x++){const si=rowStart+x*4;pixels[dst++]=src[si+2];pixels[dst++]=src[si+1];pixels[dst++]=src[si+0];pixels[dst++]=src[si+3]}}readBuffer.unmap();readBuffer.destroy();captureTexture.destroy();this._applyExportBackground(pixels,bgSpec);const tmpCanvas=document.createElement("canvas");tmpCanvas.width=W;tmpCanvas.height=H;const ctx2d=tmpCanvas.getContext("2d");if(!ctx2d){throw new Error("export3DSliceToPNGBlob: unable to get 2D context")}ctx2d.putImageData(new ImageData(pixels,W,H),0,0);const blob=await new Promise((resolve,reject)=>{tmpCanvas.toBlob(b=>{if(b)resolve(b);else reject(new Error("export3DSliceToPNGBlob: toBlob returned null"))},"image/png")});return blob}async _render3DSliceToRGBA8Pixels(view3D,width,height,zNorm,channel=0,bgSpec=null){if(!view3D)throw new Error("_render3DSliceToRGBA8Pixels: view3D is required");const W=Math.max(1,width|0);const H=Math.max(1,height|0);this.initBlitRender();const z=Math.min(Math.max(Number(zNorm)||0,0),1);const format="bgra8unorm";const captureTexture=this.device.createTexture({size:[W,H,1],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});const ab=new ArrayBuffer(16);const dv=new DataView(ab);dv.setFloat32(0,z,true);dv.setUint32(4,channel>>>0,true);dv.setUint32(8,0,true);dv.setUint32(12,0,true);this.queue.writeBuffer(this.blit3DUbo,0,ab);const bg=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:view3D},{binding:2,resource:{buffer:this.blit3DUbo}}]});const encoder=this.device.createCommandEncoder();const rpass=encoder.beginRenderPass({colorAttachments:[{view:captureTexture.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});rpass.setPipeline(this.pipeline3D);rpass.setBindGroup(0,bg);rpass.draw(6,1,0,0);rpass.end();const bytesPerPixel=4;const align=256;const bytesPerRowUnaligned=W*bytesPerPixel;const bytesPerRow=Math.ceil(bytesPerRowUnaligned/align)*align;const bufferSize=bytesPerRow*H;const readBuffer=this.device.createBuffer({size:bufferSize,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyTextureToBuffer({texture:captureTexture},{buffer:readBuffer,bytesPerRow,rowsPerImage:H},{width:W,height:H,depthOrArrayLayers:1});this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){await this.queue.onSubmittedWorkDone()}await readBuffer.mapAsync(GPUMapMode.READ);const mapped=readBuffer.getMappedRange();const src=new Uint8Array(mapped);const pixels=new Uint8ClampedArray(W*H*bytesPerPixel);let dst=0;for(let y=0;y<H;y++){const rowStart=y*bytesPerRow;for(let x=0;x<W;x++){const si=rowStart+x*4;pixels[dst++]=src[si+2];pixels[dst++]=src[si+1];pixels[dst++]=src[si+0];pixels[dst++]=src[si+3]}}readBuffer.unmap();readBuffer.destroy();captureTexture.destroy();if(bgSpec)this._applyExportBackground(pixels,bgSpec);return pixels}async export3DTilesetToPNGBlob(target,tileWidth,tileHeight,opts={}){if(!target)throw new Error("export3DTilesetToPNGBlob: target is required");const TW=Math.max(1,tileWidth|0);const TH=Math.max(1,(tileHeight??tileWidth)|0);const{depth,channel=0,chunk=0,tilesAcross=16,tilesDown=null,startSlice=0,sliceCount=null}=opts;const bgSpec=this._resolveExportBackground(opts.background);this.initBlitRender();if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}let view3D;let d;if(target&&target.views&&Array.isArray(target.views)){const idx=Math.max(0,Math.min(chunk|0,target.views.length-1));view3D=target.views[idx];d=target.meta?.tile?.d??depth}else{view3D=target;d=depth}if(!view3D)throw new Error("export3DTilesetToPNGBlob: missing 3D view");if(!d||d<=0)throw new Error("export3DTilesetToPNGBlob: depth must be provided and > 0");const across=Math.max(1,tilesAcross|0);const down=tilesDown!==null&&tilesDown!==void 0?Math.max(1,tilesDown|0):Math.ceil(d/across);const start=Math.min(Math.max(startSlice|0,0),d-1);const count=sliceCount!==null&&sliceCount!==void 0?Math.max(0,sliceCount|0):d-start;const outW=TW*across;const outH=TH*down;const outPixels=new Uint8ClampedArray(outW*outH*4);const maxZ=Math.min(d,start+count);for(let z=start;z<maxZ;z++){const rel=z-start;const col=rel%across;const row=rel/across|0;if(row>=down)break;const zNorm=(z+.5)/d;const tilePixels=await this._render3DSliceToRGBA8Pixels(view3D,TW,TH,zNorm,channel,bgSpec);const dstBaseX=col*TW;const dstBaseY=row*TH;for(let y=0;y<TH;y++){const srcRowStart=y*TW*4;const dstRowStart=((dstBaseY+y)*outW+dstBaseX)*4;outPixels.set(tilePixels.subarray(srcRowStart,srcRowStart+TW*4),dstRowStart)}}const tmpCanvas=document.createElement("canvas");tmpCanvas.width=outW;tmpCanvas.height=outH;const ctx2d=tmpCanvas.getContext("2d");if(!ctx2d)throw new Error("export3DTilesetToPNGBlob: unable to get 2D context");ctx2d.putImageData(new ImageData(outPixels,outW,outH),0,0);const blob=await new Promise((resolve,reject)=>{tmpCanvas.toBlob(b=>{if(b)resolve(b);else reject(new Error("export3DTilesetToPNGBlob: toBlob returned null"))},"image/png")});return blob}};var BaseNoise=class{constructor(seed=Date.now()){if(seed<1e7)seed*=1e7;this.seedN=seed;this.seedK=seed;this.perm=new Uint8Array(512);this.seed(seed)}seed(seed){const random=this.xorshift(seed);for(let i=0;i<256;i++){this.perm[i]=i}for(let i=255;i>0;i--){const j=Math.floor(random()*(i+1));[this.perm[i],this.perm[j]]=[this.perm[j],this.perm[i]]}for(let i=0;i<256;i++){this.perm[i+256]=this.perm[i]}}setSeed(seed){this.seedN=seed;this.seed(seed);this.resetSeed()}random(x,y,z){let idx;if(typeof z==="number"){idx=this.perm[(x&255)+this.perm[(y&255)+this.perm[z&255]]]&255}else{idx=this.perm[(x&255)+this.perm[y&255]]&255}return this.perm[idx]/255*2-1}seededRandom(){this.seedK+=Math.E;const x=1e9*Math.sin(this.seedK);return x-Math.floor(x)}resetSeed(){this.seedK=this.seedN}xorshift(seed){let x=seed;return function(){x^=x<<13;x^=x>>17;x^=x<<5;return(x<0?1+~x:x)/4294967295}}dot(g,x=0,y=0,z=0){return g[0]*x+g[1]*y+g[2]*z}};document.body.insertAdjacentHTML("afterbegin",noiseComponent_default);var UI_EXCLUDE_TRAILING_ENTRY_POINTS=6;var LABEL_OVERRIDES_BY_ENTRY={computeCellular:"CellularPattern",computeWorley:"WorleyPattern",computeAntiCellular:"AntiCellularPattern",computeAntiWorley:"AntiWorleyPattern",computeWhiteNoise:"White Noise",computeBlueNoise:"Blue Noise"};var NOISE_CONSTRAINTS_BY_ENTRY={computeRidge:{clamp:{freq:[.25,8],gain:[.2,.8],octaves:[1,12]}},computeAntiRidge:{clamp:{freq:[.25,8],gain:[.2,.8],octaves:[1,12]}},computeRidgedMultifractal:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal2:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal3:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeRidgedMultifractal4:{clamp:{freq:[.25,8],gain:[.2,.9],octaves:[2,14]}},computeFBM:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeFBM2:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeFBM3:{clamp:{gain:[.2,.8],octaves:[2,10]}},computeVoronoiBM1:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeVoronoiBM2:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeVoronoiBM3:{clamp:{threshold:[0,1],edgeK:[0,64]}},computeCellular:{clamp:{threshold:[0,1]}},computeWorley:{clamp:{threshold:[0,1]}},computeAntiCellular:{clamp:{threshold:[0,1]}},computeAntiWorley:{clamp:{threshold:[0,1]}},computeSimplexFBM:{force:{turbulence:1},clamp:{warpAmp:[.1,2],freq:[.25,6]}},computeCurl2D:{force:{turbulence:1},clamp:{warpAmp:[.1,2],freq:[.25,6]}},computeCurlFBM2D:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeDomainWarpFBM1:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeDomainWarpFBM2:{force:{turbulence:1},clamp:{warpAmp:[.1,3]}},computeGaborAnisotropic:{clamp:{gaborRadius:[.5,6]}},computeFoamNoise:{force:{turbulence:1},clamp:{gain:[.5,.95]}}};var TOROIDAL_SIZE=128;var TOROIDAL_VOLUME_KEY="toroidalDemo";var MODE_OVERRIDES=new Map;var ENTRY_POINTS=[];var NOISE_LABELS_BY_BIT=Object.create(null);function makeNoiseLabelFromEntryPoint(ep){const key=String(ep||"");const override=LABEL_OVERRIDES_BY_ENTRY[key];if(override)return override;let s=key;if(s.startsWith("compute"))s=s.slice(7);return s||key}function buildNoiseLabelsByBit(entryPoints,excludeTrailing){const out=Object.create(null);const eps=Array.isArray(entryPoints)?entryPoints:[];const drop=Math.max(0,excludeTrailing|0);const n=Math.max(0,eps.length-drop);for(let i=0;i<n;i++){out[i]=makeNoiseLabelFromEntryPoint(eps[i])}return out}function getSortedNoiseBits(){return Object.keys(NOISE_LABELS_BY_BIT).map(k=>Number(k)).filter(bit=>Number.isInteger(bit)&&bit>=0).sort((a,b)=>a-b)}function getSortedOverrideBits(){const out=[];for(let i=0;i<ENTRY_POINTS.length;i++){const ep=ENTRY_POINTS[i];if(typeof ep!=="string"||!ep)continue;if(ep==="clearTexture")continue;out.push(i)}return out}function getConstraintForBit(bit){const ep=ENTRY_POINTS[bit];if(!ep)return null;return NOISE_CONSTRAINTS_BY_ENTRY[String(ep)]||null}function clampField(obj,key,min,max){if(!Object.prototype.hasOwnProperty.call(obj,key))return;const v=Number(obj[key]);if(!Number.isFinite(v))return;const lo=Number(min);const hi=Number(max);obj[key]=Math.min(Math.max(v,lo),hi)}function buildParamsForBit(bit,globalParams){const local={...globalParams};const cfg=getConstraintForBit(bit);if(cfg&&cfg.clamp){const c=cfg.clamp;if(c.freq)clampField(local,"freq",c.freq[0],c.freq[1]);if(c.gain)clampField(local,"gain",c.gain[0],c.gain[1]);if(c.octaves)clampField(local,"octaves",c.octaves[0],c.octaves[1]);if(c.threshold)clampField(local,"threshold",c.threshold[0],c.threshold[1]);if(c.warpAmp)clampField(local,"warpAmp",c.warpAmp[0],c.warpAmp[1]);if(c.gaborRadius)clampField(local,"gaborRadius",c.gaborRadius[0],c.gaborRadius[1]);if(c.edgeK)clampField(local,"edgeK",c.edgeK[0],c.edgeK[1])}if(cfg&&cfg.force){for(const[k,v]of Object.entries(cfg.force)){local[k]=v}}const overrideObj=MODE_OVERRIDES.get(bit);if(overrideObj){for(const[k,v]of Object.entries(overrideObj)){if(typeof v==="number"&&Number.isFinite(v)){local[k]=v}}}return local}function readGlobalParamsFromUI(){const getNum=(id,fallback)=>{const el=document.getElementById(id);if(!el)return fallback;const v=Number(el.value);return Number.isFinite(v)?v:fallback};const getU32=(id,fallback)=>{const n=getNum(id,fallback);if(!Number.isFinite(n))return fallback;return Math.max(0,Math.floor(n))};const seed=Math.max(1,Math.floor(getNum("noise-seed",1234567892)));const turbEl=document.getElementById("noise-turbulence");const turbulence=turbEl&&turbEl.checked?1:0;return{seed,zoom:getNum("noise-zoom",1),freq:getNum("noise-freq",1),octaves:Math.max(1,Math.floor(getNum("noise-octaves",8))),lacunarity:getNum("noise-lacunarity",2),gain:getNum("noise-gain",.5),xShift:getNum("noise-xShift",0),yShift:getNum("noise-yShift",0),zShift:getNum("noise-zShift",0),turbulence,seedAngle:getNum("noise-seedAngle",0),exp1:getNum("noise-exp1",1),exp2:getNum("noise-exp2",0),threshold:getNum("noise-threshold",.1),rippleFreq:getNum("noise-rippleFreq",10),time:getNum("noise-time",0),warpAmp:getNum("noise-warpAmp",.5),gaborRadius:getNum("noise-gaborRadius",4),terraceStep:getNum("noise-terraceStep",8),toroidal:0,voroMode:getU32("noise-voroMode",0),edgeK:getNum("noise-edgeK",0)}}function collectSelectedBitsFromUI(){const boxes=document.querySelectorAll('input[type="checkbox"][name="noise-type"]');const bits=[];boxes.forEach(box=>{if(box.checked){const bit=Number(box.dataset.bit);if(Number.isInteger(bit))bits.push(bit)}});return bits}function getZSliceIndexFromUI(){const slider=document.getElementById("z-slice");const num=document.getElementById("z-slice-num");let idx=0;if(slider)idx=Number(slider.value);else if(num)idx=Number(num.value);if(!Number.isFinite(idx))idx=0;idx=Math.min(Math.max(Math.round(idx),0),TOROIDAL_SIZE-1);if(slider&&String(slider.value)!==String(idx))slider.value=String(idx);if(num&&String(num.value)!==String(idx))num.value=String(idx);return idx}function applyCanvasCSS(canvas,cssW=null,cssH=null,fit="contain"){canvas.style.display="block";canvas.style.margin="0";canvas.style.padding="0";canvas.style.border="0";canvas.style.outline="0";canvas.style.background="transparent";canvas.style.width=cssW!=null?`${cssW}px`:"100%";canvas.style.height=cssH!=null?`${cssH}px`:"100%";canvas.style.objectFit=fit;canvas.style.objectPosition="center";canvas.style.imageRendering="crisp-edges";canvas.style.imageRendering="pixelated"}function ensureCanvasSize(builder,canvas,w,h,cssW=null,cssH=null){const iw=Math.max(1,w|0);const ih=Math.max(1,h|0);applyCanvasCSS(canvas,cssW,cssH);let changed=false;if(canvas.width!==iw||canvas.height!==ih){canvas.width=iw;canvas.height=ih;changed=true}if(builder&&typeof builder.configureCanvas==="function"&&changed){builder.configureCanvas(canvas)}return changed}function configureMosaicLayout(mosaicRoot){mosaicRoot.style.display="grid";mosaicRoot.style.width="100%";mosaicRoot.style.height="100%";mosaicRoot.style.aspectRatio="1 / 1";mosaicRoot.style.gridTemplateColumns="repeat(3, 1fr)";mosaicRoot.style.gridTemplateRows="repeat(3, 1fr)";mosaicRoot.style.gap="0";mosaicRoot.style.padding="0";mosaicRoot.style.margin="0";mosaicRoot.style.border="0";mosaicRoot.style.lineHeight="0";mosaicRoot.style.fontSize="0";mosaicRoot.style.alignItems="stretch";mosaicRoot.style.justifyItems="stretch";mosaicRoot.style.alignContent="stretch";mosaicRoot.style.justifyContent="stretch";mosaicRoot.style.overflow="hidden";mosaicRoot.style.background="#000"}function initMainAndMosaicCanvases(){let mainCanvas=document.getElementById("noise-canvas");const stack=document.getElementById("view-stack");if(!mainCanvas&&stack){mainCanvas=document.createElement("canvas");mainCanvas.id="noise-canvas";mainCanvas.width=800;mainCanvas.height=800;stack.appendChild(mainCanvas)}if(!mainCanvas){throw new Error("Missing main preview canvas (#noise-canvas)")}applyCanvasCSS(mainCanvas,null,null,"contain");const mosaicRoot=document.getElementById("mosaic");if(!mosaicRoot){throw new Error("Missing #mosaic container")}const desired=9;let existing=Array.from(mosaicRoot.querySelectorAll("canvas"));if(existing.length!==desired){mosaicRoot.innerHTML="";existing=[];for(let i=0;i<desired;i++){const c=document.createElement("canvas");c.width=TOROIDAL_SIZE;c.height=TOROIDAL_SIZE;applyCanvasCSS(c,null,null,"fill");mosaicRoot.appendChild(c);existing.push(c)}}else{existing.forEach(c=>applyCanvasCSS(c,null,null,"fill"))}configureMosaicLayout(mosaicRoot);return{mainCanvas,mosaicCanvases:existing}}function buildModeLabelList(bits){if(!bits.length)return NOISE_LABELS_BY_BIT[0]||"Perlin";const labels=bits.map(bit=>NOISE_LABELS_BY_BIT[bit]||String(bit));return labels.join(", ")}function ensureRoot(id){const el=document.getElementById(id);if(!el)throw new Error(`Missing #${id}`);return el}function populateNoiseTypeCheckboxes(){const root=ensureRoot("noise-type-list");root.innerHTML="";const bits=getSortedNoiseBits();for(const bit of bits){const label=document.createElement("label");const input=document.createElement("input");input.type="checkbox";input.name="noise-type";input.dataset.bit=String(bit);if(bit===0)input.checked=true;label.appendChild(input);label.appendChild(document.createTextNode(" "+(NOISE_LABELS_BY_BIT[bit]||String(bit))));root.appendChild(label)}}function getToroidalCandidatesFromEntryPoints(entryPoints){const eps=Array.isArray(entryPoints)?entryPoints:[];return eps.filter(ep=>typeof ep==="string"&&/4D/.test(ep)&&ep!=="clearTexture").slice()}function populateToroidalTypeCheckboxes(entryPoints){const root=ensureRoot("toroidal-type-list");root.innerHTML="";const candidates=getToroidalCandidatesFromEntryPoints(entryPoints);const defaults=new Set(["computePerlin4D","computeWorley4D"]);let anyChecked=false;for(const ep of candidates){const label=document.createElement("label");const input=document.createElement("input");input.type="checkbox";input.name="toroidal-type";input.dataset.entry=ep;const bit=ENTRY_POINTS.indexOf(ep);if(Number.isInteger(bit)&&bit>=0){input.dataset.bit=String(bit)}if(defaults.has(ep)){input.checked=true;anyChecked=true}label.appendChild(input);label.appendChild(document.createTextNode(" "+makeNoiseLabelFromEntryPoint(ep)));root.appendChild(label)}if(!anyChecked&&candidates.length){const first=root.querySelector('input[type="checkbox"][name="toroidal-type"]');if(first)first.checked=true}}function collectSelectedToroidalModesFromUI(){const boxes=document.querySelectorAll('input[type="checkbox"][name="toroidal-type"]');const out=[];boxes.forEach(box=>{if(!box.checked)return;const entry=String(box.dataset.entry||"");if(!entry)return;let bit=Number(box.dataset.bit);if(!Number.isInteger(bit))bit=ENTRY_POINTS.indexOf(entry);if(!Number.isInteger(bit))bit=-1;out.push({bit,entry})});if(!out.length){const fallbacks=["computePerlin4D","computeWorley4D"];for(const entry of fallbacks){if(!ENTRY_POINTS.includes(entry))continue;const bit=ENTRY_POINTS.indexOf(entry);out.push({bit,entry})}}return out}function updateMosaicCaption(selectedEntries){const el=document.getElementById("mosaic-caption");if(!el)return;const modes=Array.isArray(selectedEntries)?selectedEntries:[];const pretty=modes.length?modes.map(ep=>makeNoiseLabelFromEntryPoint(ep)).join(" + "):"None";el.textContent=`A single toroidal Z slice from a 4D volume. Modes: ${pretty}. Repeated in X and Y. Use the Z slice control to see different slices.`}function populateOverrideModeSelect(){const select=document.getElementById("override-mode");if(!select)return;select.innerHTML="";const bits=getSortedOverrideBits();for(const bit of bits){const ep=ENTRY_POINTS[bit];const opt=document.createElement("option");opt.value=String(bit);opt.textContent=`${bit}: ${makeNoiseLabelFromEntryPoint(ep)}`;select.appendChild(opt)}if(bits.length)select.value=String(bits[0])}function populateOverrideFieldsForBit(bit){const overrides=MODE_OVERRIDES.get(bit)||{};const setNum=(id,key)=>{const el=document.getElementById(id);if(!el)return;const v=overrides[key];el.value=typeof v==="number"&&Number.isFinite(v)?String(v):""};const setSel=(id,key)=>{const el=document.getElementById(id);if(!el)return;const v=overrides[key];el.value=typeof v==="number"&&Number.isFinite(v)?String(v):""};setNum("ov-zoom","zoom");setNum("ov-freq","freq");setNum("ov-lacunarity","lacunarity");setNum("ov-gain","gain");setNum("ov-octaves","octaves");setSel("ov-turbulence","turbulence");setNum("ov-seedAngle","seedAngle");setNum("ov-exp1","exp1");setNum("ov-exp2","exp2");setNum("ov-rippleFreq","rippleFreq");setNum("ov-time","time");setNum("ov-warp","warpAmp");setNum("ov-threshold","threshold");setSel("ov-voroMode","voroMode");setNum("ov-edgeK","edgeK");setNum("ov-gabor","gaborRadius");setNum("ov-terraceStep","terraceStep");setNum("ov-xShift","xShift");setNum("ov-yShift","yShift");setNum("ov-zShift","zShift")}function updateOverridesFromFields(){const select=document.getElementById("override-mode");if(!select)return;const bit=Number(select.value);if(!Number.isInteger(bit))return;const readNum=id=>{const el=document.getElementById(id);if(!el)return null;const trimmed=String(el.value).trim();if(!trimmed)return null;const num=Number(trimmed);if(!Number.isFinite(num))return null;return num};const readSelNum=id=>{const el=document.getElementById(id);if(!el)return null;const trimmed=String(el.value).trim();if(!trimmed)return null;const num=Number(trimmed);if(!Number.isFinite(num))return null;return num};const obj={};const zoom=readNum("ov-zoom");const freq=readNum("ov-freq");const lacunarity=readNum("ov-lacunarity");const gain=readNum("ov-gain");const octaves=readNum("ov-octaves");const turbulence=readSelNum("ov-turbulence");const seedAngle=readNum("ov-seedAngle");const exp1=readNum("ov-exp1");const exp2=readNum("ov-exp2");const rippleFreq=readNum("ov-rippleFreq");const time=readNum("ov-time");const warpAmp=readNum("ov-warp");const threshold=readNum("ov-threshold");const voroMode=readSelNum("ov-voroMode");const edgeK=readNum("ov-edgeK");const gaborRadius=readNum("ov-gabor");const terraceStep=readNum("ov-terraceStep");const xShift=readNum("ov-xShift");const yShift=readNum("ov-yShift");const zShift=readNum("ov-zShift");if(zoom!==null)obj.zoom=zoom;if(freq!==null)obj.freq=freq;if(lacunarity!==null)obj.lacunarity=lacunarity;if(gain!==null)obj.gain=gain;if(octaves!==null)obj.octaves=octaves;if(turbulence!==null)obj.turbulence=Math.max(0,Math.floor(turbulence));if(seedAngle!==null)obj.seedAngle=seedAngle;if(exp1!==null)obj.exp1=exp1;if(exp2!==null)obj.exp2=exp2;if(rippleFreq!==null)obj.rippleFreq=rippleFreq;if(time!==null)obj.time=time;if(warpAmp!==null)obj.warpAmp=warpAmp;if(threshold!==null)obj.threshold=threshold;if(voroMode!==null)obj.voroMode=Math.max(0,Math.floor(voroMode));if(edgeK!==null)obj.edgeK=edgeK;if(gaborRadius!==null)obj.gaborRadius=gaborRadius;if(terraceStep!==null)obj.terraceStep=terraceStep;if(xShift!==null)obj.xShift=xShift;if(yShift!==null)obj.yShift=yShift;if(zShift!==null)obj.zShift=zShift;if(Object.keys(obj).length)MODE_OVERRIDES.set(bit,obj);else MODE_OVERRIDES.delete(bit)}function _isEntryPoint4D(ep){return typeof ep==="string"&&/4d/i.test(ep)}function readLockedResolutionFromUI(builder,fallback=800){const wEl=document.getElementById("res-width");const hEl=document.getElementById("res-height");const toI=(v,fb)=>{const n=Number(v);if(!Number.isFinite(n))return fb|0;return Math.max(1,Math.floor(n))};const lim=builder?.device?.limits||{};const maxTex2D=lim.maxTextureDimension2D??8192;const maxStore2D=lim.maxStorageTextureDimension2D??maxTex2D;const devMax=Math.min(maxTex2D,maxStore2D)|0;let w=toI(wEl?.value,fallback);let h=toI(hEl?.value,fallback);w=Math.min(w,devMax);h=Math.min(h,devMax);if(wEl&&String(wEl.value)!==String(w))wEl.value=String(w);if(hEl&&String(hEl.value)!==String(h))hEl.value=String(h);return{w,h}}function ensurePreviewCanvas(builder,canvas,resW,resH){const maxPreview=2048;const pw=Math.min(resW,maxPreview);const ph=Math.min(resH,maxPreview);ensureCanvasSize(builder,canvas,pw,ph)}function setPreviewHeader(text){const previewMeta=document.getElementById("preview-meta");if(previewMeta)previewMeta.textContent=text}function setPreviewStats(text){const previewStats=document.getElementById("preview-stats");if(previewStats)previewStats.textContent=text}function readTileOffsetsFromUI(){const getNum=(id,fallback=0)=>{const el=document.getElementById(id);if(!el)return fallback;const v=Number(el.value);return Number.isFinite(v)?v:fallback};return{x:getNum("res-offsetX",0),y:getNum("res-offsetY",0),z:getNum("res-offsetZ",0)}}function _tileOffsetTag(tileOffsets){if(!tileOffsets)return"";const ox=Number(tileOffsets.x)||0;const oy=Number(tileOffsets.y)||0;const oz=Number(tileOffsets.z)||0;const eps=1e-9;if(Math.abs(ox)<eps&&Math.abs(oy)<eps&&Math.abs(oz)<eps)return"";const fmt=v=>Math.abs(v)>=1?v.toFixed(2):v.toFixed(6);return` \xB7 tile offset ${fmt(ox)},${fmt(oy)},${fmt(oz)}`}function syncMainHeaderFromCache(info){if(!info)return;const resW=info.resW|0;const resH=info.resH|0;const noiseBits=Array.isArray(info.noiseBits)?info.noiseBits:[];const any4D=noiseBits.some(b=>_isEntryPoint4D(ENTRY_POINTS[b]));const tileTag=any4D?" \xB7 toroidal(4D)":"";const worldDim=Math.max(resW,resH)|0;const offTag=_tileOffsetTag(info.tileOffsets);setPreviewHeader(`Height field preview \xB7 ${resW}\xD7${resH} \xB7 world ${worldDim}\xD7${worldDim} \xB7 modes: ${buildModeLabelList(noiseBits)}${tileTag}${offTag}`);if(typeof info.computeMs==="number"&&typeof info.blitMs==="number"){setPreviewStats(`GPU compute ${info.computeMs.toFixed(1)} ms \xB7 blit ${info.blitMs.toFixed(1)} ms`)}else{setPreviewStats("")}}async function _waitForGpuIdle(builder){const q=builder?.queue||builder?.device?.queue;if(!q||typeof q.onSubmittedWorkDone!=="function")return;try{await q.onSubmittedWorkDone()}catch(_){}}async function renderMainNoise(builder,mainCanvas,opts={}){const updateUI=opts.updateUI!==false;const{w:resW,h:resH}=readLockedResolutionFromUI(builder,800);const tileOffsets=readTileOffsetsFromUI();const worldScale=Math.max(resW,resH)|0;ensurePreviewCanvas(builder,mainCanvas,resW,resH);const globalParams=readGlobalParamsFromUI();builder.buildPermTable(globalParams.seed|0);const selectedBits=collectSelectedBitsFromUI();const noiseBits=selectedBits.length?selectedBits:[0];const commonOptions={getGradient:0,outputChannel:1,baseRadius:0,heightScale:1,useCustomPos:0,squareWorld:true,worldMode:"crop"};const scrollOptions={offsetX:Number(tileOffsets.x)||0,offsetY:Number(tileOffsets.y)||0,offsetZ:Number(tileOffsets.z)||0};await _waitForGpuIdle(builder);const tComputeStart=performance.now();await builder.computeToTexture(resW,resH,globalParams,{...commonOptions,...scrollOptions,noiseChoices:["clearTexture"]});for(const bit of noiseBits){const ep=ENTRY_POINTS[bit];const params=buildParamsForBit(bit,globalParams);params.toroidal=_isEntryPoint4D(ep)?1:0;await builder.computeToTexture(resW,resH,params,{...commonOptions,...scrollOptions,noiseChoices:[bit]})}await _waitForGpuIdle(builder);const tComputeEnd=performance.now();const view=builder.getCurrentView();await _waitForGpuIdle(builder);const tBlitStart=performance.now();if(view){builder.renderTextureToCanvas(view,mainCanvas,{layer:0,channel:0,preserveCanvasSize:true,clear:true})}await _waitForGpuIdle(builder);const tBlitEnd=performance.now();const computeMs=tComputeEnd-tComputeStart;const blitMs=tBlitEnd-tBlitStart;if(updateUI){const any4D=noiseBits.some(b=>_isEntryPoint4D(ENTRY_POINTS[b]));const tileTag=any4D?" \xB7 toroidal(4D)":"";const offTag=_tileOffsetTag(tileOffsets);setPreviewHeader(`Height field preview \xB7 ${resW}\xD7${resH} \xB7 world ${worldScale}\xD7${worldScale} \xB7 modes: ${buildModeLabelList(noiseBits)}${tileTag}${offTag}`);setPreviewStats(`GPU compute ${computeMs.toFixed(1)} ms \xB7 blit ${blitMs.toFixed(1)} ms`)}return{resW,resH,noiseBits,computeMs,blitMs,tileOffsets}}async function renderToroidalDemo(builder,mosaicCanvases,state,opts={}){const draw=opts.draw!==false;const updateUI=opts.updateUI!==false;const globalParams=readGlobalParamsFromUI();builder.buildPermTable(globalParams.seed|0);const tileOffsets=readTileOffsetsFromUI();const baseParams={...globalParams,toroidal:1};const modes=collectSelectedToroidalModesFromUI();updateMosaicCaption(modes.map(m=>m.entry));await _waitForGpuIdle(builder);const t0=performance.now();let volumeView=await builder.computeToTexture3D(TOROIDAL_SIZE,TOROIDAL_SIZE,TOROIDAL_SIZE,baseParams,{noiseChoices:["clearTexture"],outputChannel:1,id:TOROIDAL_VOLUME_KEY});for(const m of modes){const bit=m.bit;const entry=m.entry;const params=Number.isInteger(bit)&&bit>=0?buildParamsForBit(bit,baseParams):{...baseParams};params.toroidal=1;volumeView=await builder.computeToTexture3D(TOROIDAL_SIZE,TOROIDAL_SIZE,TOROIDAL_SIZE,params,{noiseChoices:[entry],outputChannel:1,id:TOROIDAL_VOLUME_KEY})}await _waitForGpuIdle(builder);const t1=performance.now();state.lastToroidalVolumeView=volumeView;state.lastToroidalComputeMs=t1-t0;let sliceBlitMs=0;if(draw){sliceBlitMs=renderToroidalSlice(builder,volumeView,mosaicCanvases)}if(updateUI){const modeTag=modes.length?modes.map(m=>makeNoiseLabelFromEntryPoint(m.entry)).join(" + "):"None";const offTag=_tileOffsetTag(tileOffsets);setPreviewHeader(`Toroidal tiles \xB7 ${TOROIDAL_SIZE}\xB3 \xB7 modes: ${modeTag} \xB7 Z slice: ${getZSliceIndexFromUI()}${offTag}`);const computeMs=state.lastToroidalComputeMs.toFixed(1);const blitMs=sliceBlitMs.toFixed(1);setPreviewStats(draw?`GPU volume compute ${computeMs} ms \xB7 slice blit ${blitMs} ms`:`GPU volume compute ${computeMs} ms`)}return{computeMs:state.lastToroidalComputeMs,sliceBlitMs}}function renderToroidalSlice(builder,volumeView,mosaicCanvases,opts={}){if(!volumeView)return 0;const depth=TOROIDAL_SIZE;const zIndex=getZSliceIndexFromUI();const zNorm=(zIndex+.5)/depth;const canvases=Array.isArray(mosaicCanvases)?mosaicCanvases:[];const count=canvases.length||9;const t0=performance.now();for(let i=0;i<count;i++){const canvas=canvases[i];if(!canvas)continue;ensureCanvasSize(builder,canvas,TOROIDAL_SIZE,TOROIDAL_SIZE);builder.renderTexture3DSliceToCanvas(volumeView,canvas,{depth,zNorm,channel:0,chunk:0,preserveCanvasSize:true,clear:true})}const t1=performance.now();return t1-t0}function getActiveView(){const tilesetTab=document.getElementById("view-tab-tileset");return tilesetTab&&tilesetTab.checked?"tileset":"main"}async function initNoiseDemo(){const statsEl=document.getElementById("preview-stats");if(!navigator.gpu){console.error("WebGPU not available in this browser.");if(statsEl)statsEl.textContent="WebGPU not available in this browser.";return}const adapter=await navigator.gpu.requestAdapter();if(!adapter){console.error("Failed to get GPU adapter.");if(statsEl)statsEl.textContent="Failed to get GPU adapter.";return}const device=await adapter.requestDevice({requiredLimits:{maxBufferSize:adapter.limits.maxBufferSize}});const builder=new NoiseComputeBuilder(device,device.queue);ENTRY_POINTS=Array.isArray(builder.entryPoints)?builder.entryPoints.slice():[];NOISE_LABELS_BY_BIT=buildNoiseLabelsByBit(ENTRY_POINTS,UI_EXCLUDE_TRAILING_ENTRY_POINTS);populateNoiseTypeCheckboxes();populateToroidalTypeCheckboxes(ENTRY_POINTS);populateOverrideModeSelect();const{mainCanvas,mosaicCanvases}=initMainAndMosaicCanvases();builder.configureCanvas(mainCanvas);mosaicCanvases.forEach(c=>builder.configureCanvas(c));const overrideModeSelect=document.getElementById("override-mode");if(overrideModeSelect){const bit=Number(overrideModeSelect.value);if(Number.isInteger(bit))populateOverrideFieldsForBit(bit)}const state={lastToroidalVolumeView:null,lastToroidalComputeMs:0,lastMainInfo:null};const dirty={main:true,tileset:true};let renderInFlight=false;let wantsRender=false;const requestActiveRender=()=>{wantsRender=true;if(renderInFlight)return;renderInFlight=true;requestAnimationFrame(async()=>{wantsRender=false;const view=getActiveView();try{if(view==="main"){if(dirty.main){dirty.main=false;state.lastMainInfo=await renderMainNoise(builder,mainCanvas,{updateUI:true})}else{syncMainHeaderFromCache(state.lastMainInfo)}}else{if(dirty.tileset||!state.lastToroidalVolumeView){dirty.tileset=false;await renderToroidalDemo(builder,mosaicCanvases,state,{draw:true,updateUI:true})}else{const blitMs=renderToroidalSlice(builder,state.lastToroidalVolumeView,mosaicCanvases);const modes=collectSelectedToroidalModesFromUI();const modeTag=modes.length?modes.map(m=>makeNoiseLabelFromEntryPoint(m.entry)).join(" + "):"None";setPreviewHeader(`Toroidal tiles \xB7 ${TOROIDAL_SIZE}\xB3 \xB7 modes: ${modeTag} \xB7 Z slice: ${getZSliceIndexFromUI()}`);setPreviewStats(`GPU volume compute ${state.lastToroidalComputeMs.toFixed(1)} ms \xB7 slice blit ${blitMs.toFixed(1)} ms`)}}}catch(err){console.error(err);if(statsEl)statsEl.textContent=String(err)}renderInFlight=false;if(wantsRender)requestActiveRender()})};const markDirtyMain=(scheduleIfActive=true)=>{dirty.main=true;if(scheduleIfActive&&getActiveView()==="main")requestActiveRender()};const markDirtyTileset=(scheduleIfActive=true)=>{dirty.tileset=true;if(scheduleIfActive&&getActiveView()==="tileset")requestActiveRender()};const markDirtyBoth=()=>{dirty.main=true;dirty.tileset=true;requestActiveRender()};const overrideInputs=["ov-zoom","ov-freq","ov-lacunarity","ov-gain","ov-octaves","ov-turbulence","ov-seedAngle","ov-exp1","ov-exp2","ov-rippleFreq","ov-time","ov-warp","ov-threshold","ov-voroMode","ov-edgeK","ov-gabor","ov-terraceStep","ov-xShift","ov-yShift","ov-zShift"];overrideInputs.forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener("change",()=>{updateOverridesFromFields();markDirtyBoth()})});if(overrideModeSelect){overrideModeSelect.addEventListener("change",()=>{const bit=Number(overrideModeSelect.value);if(!Number.isInteger(bit))return;populateOverrideFieldsForBit(bit)})}const ovClear=document.getElementById("ov-clear");if(ovClear){ovClear.addEventListener("click",()=>{const select=document.getElementById("override-mode");if(!select)return;const bit=Number(select.value);if(!Number.isInteger(bit))return;MODE_OVERRIDES.delete(bit);populateOverrideFieldsForBit(bit);markDirtyBoth()})}const renderBtn=document.getElementById("render-btn");if(renderBtn){renderBtn.addEventListener("click",()=>{if(getActiveView()==="main")markDirtyMain(true);else markDirtyTileset(true)})}const applyResBtn=document.getElementById("apply-res");if(applyResBtn){applyResBtn.addEventListener("click",()=>{markDirtyBoth()})}["res-offsetX","res-offsetY","res-offsetZ"].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener("input",()=>{dirty.main=true;dirty.tileset=true;requestActiveRender()});el.addEventListener("change",()=>{dirty.main=true;dirty.tileset=true;requestActiveRender()})});const GLOBAL_PARAM_IDS=["noise-seed","noise-zoom","noise-freq","noise-octaves","noise-lacunarity","noise-gain","noise-xShift","noise-yShift","noise-zShift","noise-voroMode","noise-threshold","noise-edgeK","noise-seedAngle","noise-turbulence","noise-time","noise-warpAmp","noise-gaborRadius","noise-terraceStep","noise-exp1","noise-exp2","noise-rippleFreq"];GLOBAL_PARAM_IDS.forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener("input",()=>{dirty.main=true;dirty.tileset=true;requestActiveRender()});el.addEventListener("change",()=>{dirty.main=true;dirty.tileset=true;requestActiveRender()})});const noiseListRoot=document.getElementById("noise-type-list");if(noiseListRoot){noiseListRoot.addEventListener("change",e=>{const t=e.target;if(!t||t.name!=="noise-type")return;markDirtyMain(true)})}const toroidalListRoot=document.getElementById("toroidal-type-list");if(toroidalListRoot){toroidalListRoot.addEventListener("change",e=>{const t=e.target;if(!t||t.name!=="toroidal-type")return;updateMosaicCaption(collectSelectedToroidalModesFromUI().map(m=>m.entry));markDirtyTileset(true)})}const zSlider=document.getElementById("z-slice");const zInput=document.getElementById("z-slice-num");const rerenderSliceOnlyIfVisible=()=>{if(getActiveView()!=="tileset")return;if(!state.lastToroidalVolumeView)return;const blitMs=renderToroidalSlice(builder,state.lastToroidalVolumeView,mosaicCanvases);setPreviewHeader(`Toroidal tiles \xB7 ${TOROIDAL_SIZE}\xB3 \xB7 Z slice: ${getZSliceIndexFromUI()}`);setPreviewStats(`GPU volume compute ${state.lastToroidalComputeMs.toFixed(1)} ms \xB7 slice blit ${blitMs.toFixed(1)} ms`)};const setZSliceIndex=(idx,rerender=true)=>{let v=Number(idx);if(!Number.isFinite(v))v=0;v=Math.round(v);const depth=TOROIDAL_SIZE|0;v=(v%depth+depth)%depth;if(zSlider&&String(zSlider.value)!==String(v))zSlider.value=String(v);if(zInput&&String(zInput.value)!==String(v))zInput.value=String(v);if(rerender)rerenderSliceOnlyIfVisible()};if(zSlider){zSlider.addEventListener("input",()=>{setZSliceIndex(Number(zSlider.value),true)});zSlider.addEventListener("keydown",e=>{if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;e.preventDefault();const stepRaw=Number(zSlider.step);const step=Number.isFinite(stepRaw)&&stepRaw>0?Math.round(stepRaw):1;const cur=Number(zSlider.value);const curI=Number.isFinite(cur)?Math.round(cur):0;const next=e.key==="ArrowLeft"?curI-step:curI+step;setZSliceIndex(next,true)})}if(zInput){zInput.addEventListener("change",()=>{setZSliceIndex(Number(zInput.value),true)});zInput.addEventListener("keydown",e=>{if(e.key!=="ArrowDown"&&e.key!=="ArrowUp")return;e.preventDefault();const cur=Number(zInput.value);const curI=Number.isFinite(cur)?Math.round(cur):0;const next=e.key==="ArrowDown"?curI-1:curI+1;setZSliceIndex(next,true)})}const tabPreview=document.getElementById("view-tab-preview");const tabTileset=document.getElementById("view-tab-tileset");if(tabPreview){tabPreview.addEventListener("change",()=>{requestActiveRender()})}if(tabTileset){tabTileset.addEventListener("change",()=>{requestActiveRender()})}function _downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}function _safeFilePart(s){return String(s||"").trim().replace(/\s+/g,"_").replace(/[^a-zA-Z0-9._-]+/g,"").slice(0,120)}function getExportBackgroundFromUI(){const el=document.querySelector('input[type="radio"][name="export-bg"]:checked');const v=String(el?.value||"transparent");if(v==="black"||v==="white"||v==="transparent")return v;return"transparent"}function syncExportBackgroundToBuilder(builder2){const bg=getExportBackgroundFromUI();if(builder2&&typeof builder2.setExportBackground==="function"){builder2.setExportBackground(bg)}return bg}function wireExportBackgroundUI(builder2){syncExportBackgroundToBuilder(builder2);const radios=document.querySelectorAll('input[type="radio"][name="export-bg"]');radios.forEach(r=>{r.addEventListener("change",()=>{syncExportBackgroundToBuilder(builder2)})})}async function ensureToroidalVolumeForExport(){updateOverridesFromFields();await renderToroidalDemo(builder,mosaicCanvases,state,{draw:getActiveView()==="tileset",updateUI:getActiveView()==="tileset"})}const downloadMainBtn=document.getElementById("download-main");if(downloadMainBtn){downloadMainBtn.addEventListener("click",async()=>{try{updateOverridesFromFields();const bg=syncExportBackgroundToBuilder(builder);const resW=Number(document.getElementById("res-width")?.value)||800;const resH=Number(document.getElementById("res-height")?.value)||800;ensureCanvasSize(builder,mainCanvas,resW,resH);await renderMainNoise(builder,mainCanvas,{updateUI:getActiveView()==="main"});const blob=await builder.exportCurrent2DToPNGBlob(resW,resH,{layer:0,channel:0,background:bg});_downloadBlob(blob,"noise-main.png")}catch(e){console.error("download-main failed:",e);if(statsEl)statsEl.textContent="Export main PNG failed: "+e}})}const downloadTileBtn=document.getElementById("download-tile");if(downloadTileBtn){downloadTileBtn.addEventListener("click",async()=>{try{const bg=syncExportBackgroundToBuilder(builder);await ensureToroidalVolumeForExport();if(!state.lastToroidalVolumeView){console.warn("No toroidal volume available for export");return}const w=TOROIDAL_SIZE;const h=TOROIDAL_SIZE;const depth=TOROIDAL_SIZE;const zIndex=getZSliceIndexFromUI();const zNorm=(zIndex+.5)/depth;const blob=await builder.export3DSliceToPNGBlob(state.lastToroidalVolumeView,w,h,{depth,zNorm,channel:0,chunk:0,background:bg});_downloadBlob(blob,"noise-tile.png")}catch(e){console.error("download-tile failed:",e);if(statsEl)statsEl.textContent="Export tile PNG failed: "+e}})}async function saveToroidalTileset(builder2,state2){if(!state2)return;const bg=syncExportBackgroundToBuilder(builder2);await ensureToroidalVolumeForExport();if(!state2.lastToroidalVolumeView){console.warn("No toroidal volume available for tileset export");return}const globalParams=readGlobalParamsFromUI();const modes=collectSelectedToroidalModesFromUI().map(m=>m.entry);const cols=16;const tileW=TOROIDAL_SIZE;const tileH=TOROIDAL_SIZE;const depth=TOROIDAL_SIZE;const rows=Math.ceil(depth/cols);const blob=await builder2.export3DTilesetToPNGBlob(state2.lastToroidalVolumeView,tileW,tileH,{depth,channel:0,chunk:0,tilesAcross:cols,tilesDown:rows,startSlice:0,sliceCount:depth,background:bg});const modeTag=_safeFilePart(modes.map(makeNoiseLabelFromEntryPoint).join("+"))||"tileset";const seedTag=_safeFilePart(globalParams.seed);const filename=`noise-tileset_${modeTag}_seed${seedTag}_${tileW}x${tileH}_z${depth}_${cols}x${rows}.png`;_downloadBlob(blob,filename)}const downloadTilesetBtn=document.getElementById("download-tileset");if(downloadTilesetBtn){downloadTilesetBtn.addEventListener("click",async()=>{try{await saveToroidalTileset(builder,state)}catch(e){console.error("download-tileset failed:",e);if(statsEl)statsEl.textContent="Export tileset failed: "+e}})}wireExportBackgroundUI(builder);updateMosaicCaption(collectSelectedToroidalModesFromUI().map(m=>m.entry));requestActiveRender()}document.addEventListener("DOMContentLoaded",()=>{initNoiseDemo().catch(err=>console.error(err))});})();
