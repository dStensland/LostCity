// Stub for web-push in test environments.
// The real web-push package is not installed in CI/test; this prevents
// Vite transform errors when push-notifications.ts is imported transitively.
export const setVapidDetails = () => {};
export const sendNotification = async () => ({ statusCode: 201, body: "", headers: {} });
export default { setVapidDetails, sendNotification };
