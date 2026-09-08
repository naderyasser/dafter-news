/**
 * How readers reach the newsroom — one place, read by the footer and the
 * sign-in card. There is no outbound mail on this host (see the backend's
 * EMAIL_HOST note in settings.py), so a reader who loses a password writes
 * to this address rather than to a reset flow that could never send.
 */
export const CONTACT_EMAIL = "aldaftarnews@gmail.com";

/** wa.me takes digits only, no "+" and no spaces. */
export const WHATSAPP_NUMBER = "201035682002";
export const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}`;

/** A pre-addressed mail for the password-help link on the sign-in card. */
export const PASSWORD_HELP_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("استعادة كلمة المرور — الدفتر نيوز")}`;
