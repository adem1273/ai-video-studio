declare module 'kokoro-js' {
  export class KokoroTTS {
    static from_pretrained(
      model: string,
      opts?: { dtype: string; device: string },
    ): Promise<KokoroTTS>;
    generate(
      text: string,
      opts?: { voice: string },
    ): Promise<Float32Array>;
  }
}
