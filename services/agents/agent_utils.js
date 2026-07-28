function normalizeProjectName(value) {
  return (value || 'zaire-builder-core')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'zaire-builder-core';
}

function safeDisplayText(value, fallback = '') {
  return String(value || fallback).replace(/[{}<>]/g, '').trim();
}

function normalizeBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value || '').trim().toLowerCase();
  return ['yes', 'true', '1', 'on', 'enabled', 'checked'].includes(text);
}

function inferProjectTypeLabel(projectType) {
  const labels = {
    saas: 'SaaS Platform',
    portfolio: 'Portfolio',
    agent: 'AI Agent',
    mobile: 'Mobile App',
    dashboard: 'Dashboard',
    custom: 'Custom Project'
  };
  return labels[projectType] || 'Custom Project';
}

module.exports = {
  normalizeProjectName,
  safeDisplayText,
  normalizeBooleanLike,
  inferProjectTypeLabel
};
