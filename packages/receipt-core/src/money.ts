import type { Currency, Money } from './types.js';

const MONEY_PATTERN = /^(0|[1-9][0-9]*)\.([0-9]{2})$/;
const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/;

export function assertDecimal(value: string): void {
  if (!DECIMAL_PATTERN.test(value)) throw new TypeError(`Invalid decimal string: ${value}`);
}

export function money(currency: Currency, amount: string): Money {
  if (!MONEY_PATTERN.test(amount)) throw new TypeError(`Money requires exactly two decimal places: ${amount}`);
  return { currency, amount };
}

export function moneyToMinorUnits(value: Money): bigint {
  if (!MONEY_PATTERN.test(value.amount)) throw new TypeError(`Invalid money amount: ${value.amount}`);
  const [whole = '0', fraction = '00'] = value.amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction);
}

export function minorUnitsToMoney(currency: Currency, value: bigint): Money {
  if (value < 0n) throw new RangeError('Receipt money cannot be negative; use adjustment semantics instead.');
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return { currency, amount: `${whole}.${fraction}` };
}

export function formatMoney(value: Money): string {
  const minor = moneyToMinorUnits(value);
  const whole = (minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (minor % 100n).toString().padStart(2, '0');
  return `$${whole}.${fraction} ${value.currency}`;
}
