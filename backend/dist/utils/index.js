"use strict";
// backend/utils/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toISO = toISO;
exports.lastNDays = lastNDays;
exports.generateUniqueId = generateUniqueId;
exports.generateSlug = generateSlug;
function toISO(d) {
    const dt = new Date(d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function lastNDays(n) {
    const days = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        d.setUTCDate(d.getUTCDate() - i);
        days.push(toISO(d));
    }
    return days;
}
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
function generateSlug(title) {
    const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    return `${baseSlug}-${Date.now().toString(36)}`;
}
