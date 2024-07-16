export const formatPhoneNumber = (phoneNumber: string) => {
  // Trim any extraneous whitespace or control characters from wa_id
  phoneNumber = phoneNumber.trim()

  // Check wa_id if it starts with 60 for Malaysian numbers
  // If not, add the missing parts it could start with 0 or 1
  if (phoneNumber.startsWith('60')) {
    phoneNumber = '' + phoneNumber
  } else if (phoneNumber.startsWith('1')) {
    phoneNumber = '60' + phoneNumber
  } else if (phoneNumber.startsWith('0')) {
    phoneNumber = '6' + phoneNumber
  }

  // Ensure that there is only number present in the string (as we have '\r' at the end for some numbers)
  phoneNumber = phoneNumber.replace(/\D/g, '')
  return phoneNumber
}
