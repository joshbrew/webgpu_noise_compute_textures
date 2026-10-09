// Lightweight, structured timing for cloud startup and frame work.
// Snapshots are plain structured-cloneable objects so workers can return them.

function timingNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function cloneDetail(detail) {
  if (detail === undefined) return undefined;
  if (detail === null || typeof detail !== "object") return detail;
  try {
    return structuredClone(detail);
  } catch {}
  try {
    return JSON.parse(JSON.stringify(detail));
  } catch {}
  return String(detail);
}

export class CloudTimingReport {
  constructor(label = "cloud", metadata = {}) {
    this.label = String(label || "cloud");
    this.metadata = cloneDetail(metadata) || {};
    this.startedAt = timingNow();
    this.finishedAt = null;
    this.stages = [];
    this.milestones = [];
    this._openStages = new Map();
    this._nextStageId = 1;
  }

  start(name, detail = undefined, category = "work") {
    const id = this._nextStageId++;
    const stage = {
      id,
      name: String(name),
      category: String(category || "work"),
      startMs: timingNow() - this.startedAt,
      endMs: null,
      durationMs: null,
      status: "running",
    };
    const cloned = cloneDetail(detail);
    if (cloned !== undefined) stage.detail = cloned;
    this.stages.push(stage);
    this._openStages.set(id, stage);
    return id;
  }

  end(id, detail = undefined, status = "ok") {
    const stage = this._openStages.get(id);
    if (!stage) return null;
    stage.endMs = timingNow() - this.startedAt;
    stage.durationMs = Math.max(0, stage.endMs - stage.startMs);
    stage.status = String(status || "ok");
    const cloned = cloneDetail(detail);
    if (cloned !== undefined) {
      stage.detail = stage.detail && typeof stage.detail === "object" && cloned && typeof cloned === "object"
        ? { ...stage.detail, ...cloned }
        : cloned;
    }
    this._openStages.delete(id);
    return stage;
  }

  fail(id, error, detail = undefined) {
    const message = String(error?.message || error || "Unknown error");
    return this.end(id, { ...(detail || {}), error: message }, "error");
  }

  mark(name, detail = undefined) {
    const milestone = {
      name: String(name),
      atMs: timingNow() - this.startedAt,
    };
    const cloned = cloneDetail(detail);
    if (cloned !== undefined) milestone.detail = cloned;
    this.milestones.push(milestone);
    return milestone;
  }

  record(name, durationMs, detail = undefined, category = "work", startMs = undefined) {
    const duration = Math.max(0, Number(durationMs) || 0);
    const endMs = timingNow() - this.startedAt;
    const stage = {
      id: this._nextStageId++,
      name: String(name),
      category: String(category || "work"),
      startMs: Number.isFinite(startMs) ? Math.max(0, Number(startMs)) : Math.max(0, endMs - duration),
      endMs: Number.isFinite(startMs) ? Math.max(0, Number(startMs)) + duration : endMs,
      durationMs: duration,
      status: "ok",
    };
    const cloned = cloneDetail(detail);
    if (cloned !== undefined) stage.detail = cloned;
    this.stages.push(stage);
    return stage;
  }

  async measure(name, work, detail = undefined, category = "work") {
    const id = this.start(name, detail, category);
    try {
      const value = await work();
      this.end(id);
      return value;
    } catch (error) {
      this.fail(id, error);
      throw error;
    }
  }

  finish(metadata = undefined) {
    const endedAt = timingNow();
    for (const [id] of this._openStages) this.end(id, undefined, "unfinished");
    this.finishedAt = endedAt;
    const cloned = cloneDetail(metadata);
    if (cloned && typeof cloned === "object") this.metadata = { ...this.metadata, ...cloned };
    return this.snapshot();
  }

  snapshot() {
    const end = this.finishedAt ?? timingNow();
    const stages = this.stages.map((stage) => cloneDetail(stage));
    const byName = {};
    for (const stage of stages) {
      if (!Number.isFinite(stage.durationMs)) continue;
      byName[stage.name] = (byName[stage.name] || 0) + stage.durationMs;
    }
    return {
      label: this.label,
      metadata: cloneDetail(this.metadata) || {},
      totalMs: Math.max(0, end - this.startedAt),
      complete: this.finishedAt !== null,
      stages,
      milestones: this.milestones.map((milestone) => cloneDetail(milestone)),
      byName,
    };
  }
}

export function logCloudTimingReport(report, prefix = "[CLOUD TIMING]") {
  if (!report || typeof console === "undefined") return report;
  const rows = (report.stages || []).map((stage) => ({
    stage: stage.name,
    category: stage.category,
    ms: Number.isFinite(stage.durationMs) ? Math.round(stage.durationMs * 100) / 100 : null,
    status: stage.status,
  }));
  try {
    console.groupCollapsed(`${prefix} ${report.label}: ${Math.round((report.totalMs || 0) * 100) / 100} ms`);
    console.table(rows);
    console.log(report);
    console.groupEnd();
  } catch {
    console.log(prefix, report);
  }
  return report;
}
