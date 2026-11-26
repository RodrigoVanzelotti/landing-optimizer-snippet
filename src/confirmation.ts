import { isSafeSelector } from './sanitize';
import type { ConfirmationRule } from './types';

const ATTEMPT_WINDOW_MS = 2 * 60 * 1000;

/** Observe an existing success-only element after an action on the same route. */
export class ConfirmationTracker {
  private rules: ConfirmationRule[] = [];
  private active = new Map<ConfirmationRule, number>();

  constructor(private readonly emit: (selector: string, formSelector?: string) => void) {}

  setRules(rules: ConfirmationRule[]): void {
    this.rules = rules.filter(rule =>
      validSelector(rule.selector) && (!rule.formSelector || validSelector(rule.formSelector)),
    );
    this.reset();
  }

  reset(): void {
    this.active.clear();
  }

  arm(path: string, formSelector?: string): void {
    for (const rule of this.rules) {
      if (rule.path !== path || (rule.formSelector && rule.formSelector !== formSelector)) continue;
      if (!visible(rule.selector)) this.active.set(rule, Date.now() + ATTEMPT_WINDOW_MS);
    }
  }

  check(): void {
    const now = Date.now();
    for (const [rule, expires] of this.active) {
      if (expires < now) {
        this.active.delete(rule);
      } else if (visible(rule.selector)) {
        this.active.delete(rule);
        this.emit(rule.selector, rule.formSelector);
      }
    }
  }
}

function validSelector(selector: string): boolean {
  return /^\[data-lo-id="[a-z][a-z0-9-]{0,63}"\]$/.test(selector) && isSafeSelector(selector);
}

function visible(selector: string): boolean {
  const matches = document.querySelectorAll(selector);
  const element = matches[0];
  if (matches.length !== 1 || !element || element.closest('[data-lo-ignore], [hidden], [aria-hidden="true"], input[type="password"]')) return false;
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  }
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
}
