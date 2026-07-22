declare module "ffmpeg-static" {
  /**
   * Path to the ffmpeg binary bundled by ffmpeg-static.
   * Returns null if the binary is not available for the current platform.
   */
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
