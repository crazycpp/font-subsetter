// Set PUBLIC_ENABLE_CFF_SUBSET=false at build time to retain the established
// TrueType path while temporarily declining CFF/PostScript input.
export const CFF_SUBSETTING_ENABLED =
  import.meta.env.PUBLIC_ENABLE_CFF_SUBSET !== "false";
