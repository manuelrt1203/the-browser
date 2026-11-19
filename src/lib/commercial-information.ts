/** Public information supplied by the owner; no address or registration invented. */
export function commercialInformation() {
  return {
    name: process.env.SELLER_NAME?.trim() || "Rodrigue Emmanuel",
    legalStatus: process.env.SELLER_LEGAL_STATUS?.trim() || "Entrepreneur individuel (statut déclaré)",
    country: process.env.SELLER_COUNTRY?.trim() || "France",
    address: process.env.SELLER_ADDRESS?.trim() || null,
    registration: process.env.SELLER_REGISTRATION?.trim() || null,
    supportEmail: process.env.SUPPORT_EMAIL?.trim() || "manuelrt1203@gmail.com",
  };
}
