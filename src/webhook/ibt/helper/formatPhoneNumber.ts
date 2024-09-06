export const formatPhoneNumber = (phone: string): string => {
  // Remove '+' if present
  if (phone.startsWith('+')) {
    phone = phone.substring(1);
  }

  // Remove leading '0' if present
  if (phone.startsWith('0')) {
    phone = phone.substring(1);
  }

  // Remove ' ' if present
  phone = phone.replace(' ', '');

  // Check if the number starts with "60" (Malaysia)
  if (phone.startsWith('60')) {
    const numberAfterCountryCode = phone.substring(2);
    // Check if it's a valid Singaporean number (8 digits long)
    if (/^\d{8}$/.test(numberAfterCountryCode)) {
      // Convert to Singapore number by replacing "60" with "65"
      phone = `65${numberAfterCountryCode}`;
    } else if (/^[13-8]/.test(numberAfterCountryCode)) {
      // Otherwise, assume it's a valid Malaysian number (no change needed)
      phone = `60${numberAfterCountryCode}`;
    } else {
      // If it doesn't match any criteria, mark as invalid
      phone = 'Invalid';
    }
  } 
  // Check if the number starts with "65" (Singapore)
  else if (phone.startsWith('65')) {
    const numberAfterCountryCode = phone.substring(2);
    // Ensure it's a valid Singaporean number (must be 8 digits)
    if (!/^\d{8}$/.test(numberAfterCountryCode)) {
      phone = 'Invalid';
    }
  } 
  // Check if the number starts with "673" (Brunei)
  else if (phone.startsWith('673')) {
    const numberAfterCountryCode = phone.substring(3);
    // Assuming Brunei numbers are 7 digits long
    if (!/^\d{7}$/.test(numberAfterCountryCode)) {
      phone = 'Invalid';
    }
  } 
  else {
    // If it doesn't start with "60", "65", or "673", mark as invalid
    phone = 'Invalid';
  }
  
  return phone;
};
