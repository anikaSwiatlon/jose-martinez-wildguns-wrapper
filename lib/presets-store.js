// lib/presets-store.js
//
// Thin wrapper around chrome.storage.local for the resource-transfer presets.
// Each preset is a complete transport spec:
//   { id, name, targetX, targetY, amountWood, amountBrick, amountOre, amountFood, createdAt }
//
// Constraints:
// - Max 10 presets. The 11th add silently evicts the oldest by createdAt.
// - id is a monotonic-ish string (createdAt as ms).
// - Mutation helpers return the NEW array so callers can rerender.
//
// Exposed via `self.presetsStore` in the popup (service-worker-style global) and
// CommonJS `module.exports` for Jest.

const MAX_PRESETS = 10;
const STORAGE_KEY = "marketPresets";

function isInt(n) {
  return typeof n === "number" && Number.isInteger(n) && Number.isFinite(n);
}

function validatePreset(p) {
  if (!p || typeof p !== "object") return "preset must be an object";
  if (typeof p.name !== "string" || !p.name.trim()) return "name is required";
  if (!isInt(p.targetX) || p.targetX < 0) return "targetX must be a non-negative integer";
  if (!isInt(p.targetY) || p.targetY < 0) return "targetY must be a non-negative integer";
  for (const key of ["amountWood", "amountBrick", "amountOre", "amountFood"]) {
    if (!isInt(p[key]) || p[key] < 0) return `${key} must be a non-negative integer`;
  }
  const total = p.amountWood + p.amountBrick + p.amountOre + p.amountFood;
  if (total <= 0) return "at least one resource amount must be greater than zero";
  return null;
}

function normalizePreset(input) {
  const id = input.id ?? `p${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    id,
    name:        String(input.name).trim(),
    targetX:     parseInt(input.targetX, 10),
    targetY:     parseInt(input.targetY, 10),
    amountWood:  parseInt(input.amountWood,  10) || 0,
    amountBrick: parseInt(input.amountBrick, 10) || 0,
    amountOre:   parseInt(input.amountOre,   10) || 0,
    amountFood:  parseInt(input.amountFood,  10) || 0,
    createdAt:   input.createdAt ?? Date.now(),
  };
}

async function loadPresets(storage) {
  const result = await storage.get([STORAGE_KEY]);
  const arr = result[STORAGE_KEY];
  return Array.isArray(arr) ? arr : [];
}

async function savePresets(storage, presets) {
  await storage.set({ [STORAGE_KEY]: presets });
  return presets;
}

// Pure function — given the current list + a new preset, returns the updated
// list with the LRU cap applied and a `dropped` field naming the evicted entry
// if any. Caller still has to persist with savePresets.
function addPresetWithCap(current, newPreset) {
  const normalized = normalizePreset(newPreset);
  const err = validatePreset(normalized);
  if (err) {
    const e = new Error(err);
    e.code = "INVALID_PRESET";
    throw e;
  }
  const list = [...current, normalized];
  if (list.length <= MAX_PRESETS) {
    return { presets: list, dropped: null };
  }
  // Evict the oldest by createdAt
  list.sort((a, b) => a.createdAt - b.createdAt);
  const dropped = list.shift();
  return { presets: list, dropped };
}

function removePreset(current, id) {
  return current.filter(p => p.id !== id);
}

function findPreset(current, id) {
  return current.find(p => p.id === id) ?? null;
}

const api = {
  MAX_PRESETS, STORAGE_KEY,
  validatePreset, normalizePreset,
  loadPresets, savePresets,
  addPresetWithCap, removePreset, findPreset,
};

if (typeof self !== "undefined") self.presetsStore = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
