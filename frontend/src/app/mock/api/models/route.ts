/**
 * UnityGrid Agent Flow — Mock Models API
 * Returns the NIM-only model catalogue for mock/dev mode.
 * All third-party model references have been removed.
 */
export function GET() {
  return Response.json({
    models: [
      {
        id: "nvidia/nemotron-70b-instruct",
        name: "nvidia/nemotron-70b-instruct",
        display_name: "NVIDIA Nemotron-70B Instruct",
        supports_thinking: true,
      },
      {
        id: "nvidia/nemotron-4-340b-instruct",
        name: "nvidia/nemotron-4-340b-instruct",
        display_name: "NVIDIA Nemotron-4 340B Instruct",
        supports_thinking: true,
      },
    ],
  });
}
