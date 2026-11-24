/**
 * Spotting videos that won't play on computers. Phones (e.g. OnePlus with "HEVC" switched on, iPhones on
 * "High Efficiency") record HEVC / H.265 video, which Chrome and Edge on Windows usually can't play: the video
 * stays black and has no thumbnail. The phone itself plays it fine, so we look inside the file instead.
 */

export const HEVC_WARNING =
  "This video is in HEVC (H.265) format, so it may not play on computers. On the phone, switch the camera's video format from HEVC to H.264 and record again.";

export const UNPLAYABLE_WARNING = "This browser can't play this video, so others may not be able to see it either.";

// The box names an MP4/MOV file uses for HEVC video tracks (plain HEVC, and Dolby Vision built on HEVC).
const MARKERS = ["hvc1", "hev1", "dvh1", "dvhe"].map((m) => Array.from(m, (c) => c.charCodeAt(0)));

/** True if these bytes (part of an MP4/MOV file) contain an HEVC video track marker. */
export function hasHevcMarker(bytes: Uint8Array): boolean {
  for (let i = 0; i + 4 <= bytes.length; i++) {
    for (const m of MARKERS) {
      if (bytes[i] === m[0] && bytes[i + 1] === m[1] && bytes[i + 2] === m[2] && bytes[i + 3] === m[3]) return true;
    }
  }
  return false;
}
