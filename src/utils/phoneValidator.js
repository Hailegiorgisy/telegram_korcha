/**
 * Validates and standardens Ethiopian phone numbers.
 * Accepts:
 *   - 09XXXXXXXX (Ethio Telecom)
 *   - 07XXXXXXXX (Safaricom Ethiopia)
 *   - +2519XXXXXXXX or +2517XXXXXXXX
 */
export function validateAndFormatEthioPhone(input) {
  if (!input) return null;

  // Remove spaces, dashes, and parentheses
  let cleaned = input.trim().replace(/[\s\-\(\)]/g, '');

  // Normalize +251 or 251 prefix to local 0 format
  if (cleaned.startsWith('+251')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('251')) {
    cleaned = '0' + cleaned.slice(3);
  }

  // Strict check: must start with 09 or 07 and be exactly 10 digits
  const ethioPhoneRegex = /^(09|07)\d{8}$/;

  return ethioPhoneRegex.test(cleaned) ? cleaned : null;
}
