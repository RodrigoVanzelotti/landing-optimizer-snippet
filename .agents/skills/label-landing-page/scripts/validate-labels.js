// Read-only DOM check; evaluate in the rendered page before SDK initialization/reload verification.
(() => {
  const roles = new Set(['hero', 'pricing', 'testimonials', 'faq', 'navigation', 'footer', 'form', 'cta', 'heading', 'section']);
  const pii = [/[^\s@]+@[^\s@]+\.[^\s@]+/, /(\+?\d[\d\s().-]{7,}\d)/, /\b(?:\d[ -]*?){13,16}\b/, /\b\d{3}-\d{2}-\d{4}\b/];
  const labels = Array.from(document.querySelectorAll('[data-lo-role]'));
  const counts = new Map();
  for (const element of document.querySelectorAll('[data-lo-id]')) {
    const id = element.getAttribute('data-lo-id');
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const errors = [];
  const warnings = [];
  const nodes = [];
  labels.forEach((element, index) => {
    const name = `Labeled element ${index + 1} (${element.tagName.toLowerCase()})`;
    if (element.closest('[data-lo-ignore], input[type="password"]')) {
      warnings.push(`${name}: excluded by the SDK; this role still enables manual mode.`);
      return;
    }
    const role = element.getAttribute('data-lo-role');
    const id = element.getAttribute('data-lo-id');
    const issues = [];
    if (!roles.has(role)) issues.push('unsupported role');
    if (!id || !/^[a-z][a-z0-9-]{0,63}$/.test(id)) issues.push('missing or malformed data-lo-id');
    if (id && pii.some(pattern => pattern.test(id))) issues.push('data-lo-id resembles personal information');
    if (id && counts.get(id) !== 1) issues.push('data-lo-id is duplicated in the document');
    if (role === 'form' && element.tagName !== 'FORM') issues.push('form role requires a real form element');
    if (issues.length) {
      errors.push(`${name}: ${issues.join('; ')}.`);
      return;
    }
    nodes.push({ role, id, selector: `[data-lo-id="${id}"]` });
    if (role === 'cta' && !element.matches('a[href], button, input[type="submit"], input[type="button"]')) {
      warnings.push(`${name}: verify the custom CTA's click and keyboard behavior.`);
    }
  });
  if (!labels.length) warnings.push('No manual labels found; the SDK will use automatic discovery.');
  if (labels.length && !nodes.length) errors.push('Manual mode is active but no valid mapped elements remain.');
  if (nodes.length > 60) errors.push(`${nodes.length} mapped elements exceed the 60 transmitted-element limit.`);
  return { valid: labels.length > 0 && errors.length === 0, manualMode: labels.length > 0,
    mappedCount: nodes.length, nodes, errors, warnings };
})();
