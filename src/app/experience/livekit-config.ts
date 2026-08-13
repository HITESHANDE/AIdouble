// LiveKit voice mode for the Experience Zone call button.
//
// TEMPORARY: the API secret is signed in the browser by LivekitVoice.mintToken(),
// so it ships in the public AIdouble JS bundle and is readable by anyone. This is
// a demo spike only — move token minting behind a server endpoint before any
// deploy, and rotate this key when you do.
//
// The room is served by the worker in D:\Gosure2\livekit-voice-agent. Voice mode
// stays silent unless that worker is running against this same LiveKit project.
// Set this to the AGENT_NAME your local worker runs with to send calls to it
// instead of the deployed one. Empty means normal automatic dispatch.
export const LIVEKIT_AGENT_NAME = '';

// Krisp's background-voice cancellation is off until it is cleared of
// swallowing the caller's own voice. Set to true to put it back.
export const LIVEKIT_NOISE_FILTER = false;

export const LIVEKIT_URL = 'wss://ai-double-3daj2l7p.livekit.cloud';
export const LIVEKIT_API_KEY = 'APIiACLXSkzryFa';
export const LIVEKIT_API_SECRET = 'erfKVveSqxzaCJRV2Xb34qJqtj1O3jyouuq0UHXASTgB';
