export const formatPhoneNumber = (phone: string) => {
  /// Remove leading '0' if present
  if (phone.startsWith('0')) {
    phone = phone.substring(1)
  }
  // Check if the number starts with "60"
  if (phone.startsWith('60')) {
    const numberAfterCountryCode = phone.substring(2)
    // Check if it's a valid Singaporean number (8 digits long)
    if (/^\d{8}$/.test(numberAfterCountryCode)) {
      // Convert to Singapore number by replacing "60" with "65"
      phone = `65${numberAfterCountryCode}`
    } else if (/^[13-8]/.test(numberAfterCountryCode)) {
      // Otherwise, assume it's a valid Malaysian number (no change needed)
      phone = `60${numberAfterCountryCode}`
    } else {
      // If it doesn't match any criteria, mark as invalid
      phone = 'Invalid'
    }
  } else if (phone.startsWith('65')) {
    // Ensure it's a valid Singaporean number (must be 8 digits)
    const numberAfterCountryCode = phone.substring(2)
    if (!/^\d{8}$/.test(numberAfterCountryCode)) {
      phone = 'Invalid'
    }
  } else {
    // If it doesn't start with "60" or "65", mark as invalid
    phone = 'Invalid'
  }
  return phone
}
