// validation.js — Centralized input validation rules & boundary constraints

export const LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 254,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 200,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 100000,
  MIN_PRICE: 0.01,
  MAX_PRICE: 9999999999,
  MAX_NOTE_LENGTH: 2000,
  MAX_PHONE_LENGTH: 30,
  MAX_ADDRESS_LINE_LENGTH: 500,
  MAX_DISTRICT_LENGTH: 100,
  MAX_PROVINCE_LENGTH: 100,
  MAX_POSTAL_CODE_LENGTH: 15
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistrationInput(input = {}) {
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!fullName || !email || !password) {
    return { valid: false, error: 'Full name, email and password are required.' };
  }
  if (fullName.length > LIMITS.MAX_NAME_LENGTH) {
    return { valid: false, error: `Full name must be ${LIMITS.MAX_NAME_LENGTH} characters or fewer.` };
  }
  if (email.length > LIMITS.MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Enter a valid email address.' };
  }
  if (password.length < LIMITS.MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${LIMITS.MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > LIMITS.MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be ${LIMITS.MAX_PASSWORD_LENGTH} characters or fewer.` };
  }
  return { valid: true, sanitized: { fullName, email, password } };
}

export function validateOfferLimits(input = {}) {
  const { price, quantity, defects = '', notes = '' } = input;

  if (!Number.isSafeInteger(quantity) || quantity < LIMITS.MIN_QUANTITY || quantity > LIMITS.MAX_QUANTITY) {
    return { valid: false, error: `Quantity must be an integer between ${LIMITS.MIN_QUANTITY} and ${LIMITS.MAX_QUANTITY}.` };
  }
  if (!Number.isFinite(price) || price < LIMITS.MIN_PRICE || price > LIMITS.MAX_PRICE) {
    return { valid: false, error: 'Price must be a positive number within system limits.' };
  }
  // Check max 2 decimal places
  if (Math.abs(price * 100 - Math.round(price * 100)) > 0.0001) {
    return { valid: false, error: 'Price can have at most 2 decimal places.' };
  }
  if (typeof defects !== 'string' || defects.length > LIMITS.MAX_NOTE_LENGTH) {
    return { valid: false, error: `Defects must be ${LIMITS.MAX_NOTE_LENGTH} characters or fewer.` };
  }
  if (typeof notes !== 'string' || notes.length > LIMITS.MAX_NOTE_LENGTH) {
    return { valid: false, error: `Notes must be ${LIMITS.MAX_NOTE_LENGTH} characters or fewer.` };
  }
  return { valid: true };
}

export function validateAddressLimits(input = {}) {
  const recipientName = typeof input.recipientName === 'string' ? input.recipientName.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const addressLine = typeof input.addressLine === 'string' ? input.addressLine.trim() : '';
  const district = typeof input.district === 'string' ? input.district.trim() : '';
  const province = typeof input.province === 'string' ? input.province.trim() : '';
  const postalCode = typeof input.postalCode === 'string' ? input.postalCode.trim() : '';

  if (!recipientName || !phone || !addressLine || !district || !province || !postalCode) {
    return { valid: false, error: 'All address fields are required.' };
  }
  if (recipientName.length > LIMITS.MAX_NAME_LENGTH) return { valid: false, error: 'Recipient name too long.' };
  if (phone.length > LIMITS.MAX_PHONE_LENGTH) return { valid: false, error: 'Phone number too long.' };
  if (addressLine.length > LIMITS.MAX_ADDRESS_LINE_LENGTH) return { valid: false, error: 'Address line too long.' };
  if (district.length > LIMITS.MAX_DISTRICT_LENGTH) return { valid: false, error: 'District name too long.' };
  if (province.length > LIMITS.MAX_PROVINCE_LENGTH) return { valid: false, error: 'Province name too long.' };
  if (postalCode.length > LIMITS.MAX_POSTAL_CODE_LENGTH) return { valid: false, error: 'Postal code too long.' };

  return { valid: true, sanitized: { recipientName, phone, addressLine, district, province, postalCode } };
}
