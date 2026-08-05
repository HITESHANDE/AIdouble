// LiveKit voice mode for the Experience Zone call button.
//
// TEMPORARY: the API secret is signed in the browser by LivekitVoice.mintToken(),
// so it ships in the public AIdouble JS bundle and is readable by anyone. This is
// a demo spike only — move token minting behind a server endpoint before any
// deploy, and rotate this key when you do.
//
// The room is served by the worker in D:\Gosure2\livekit-voice-agent. Voice mode
// stays silent unless that worker is running against this same LiveKit project.
export const LIVEKIT_URL = 'wss://ai-double-iq9fx1t3.livekit.cloud';
export const LIVEKIT_API_KEY = 'APIgBzTScEwWepP';
export const LIVEKIT_API_SECRET = 'DZOvSKrufZJyVeP9HQPemuYwhV91SGexNSNGmtoROCPD';
