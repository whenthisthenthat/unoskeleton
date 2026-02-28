/**
 * OPVault file format regex patterns
 *
 * Centralized patterns for parsing OPVault file formats.
 * All OPVault files use JavaScript object notation (not JSON).
 */

/** Matches profile.js: "var profile = {...};" */
export const PROFILE_PATTERN = /var\s+profile\s*=\s*({.+});?\s*$/s;

/** Matches band/folder files: "ld({...});" */
export const LD_WRAPPER_PATTERN = /ld\s*\(({.+})\);?\s*$/s;

/** Matches band filenames: "band_X.js" where X is 0-9 or A-F */
export const BAND_FILENAME_PATTERN = /^band_([0-9A-F])\.js$/;

/** Matches attachment filenames: "{itemUUID}_{attachmentUUID}.attachment" */
export const ATTACHMENT_FILENAME_PATTERN =
  /^([0-9A-F]{32})_([0-9A-F]{32})\.attachment$/;
