// Stub for z-ai-web-dev-sdk when not available (e.g., Vercel production)
// This allows the build to succeed without the SDK installed.
// Routes that use AI will fall back to mock/manual responses.

const stub = {
  create: async () => {
    throw new Error('AI SDK not available in this environment');
  },
};

export default stub;
