/**
 * Opinionated end-to-end workflows. Each recipe composes the typed
 * `client/*` sub-packages and the auth flows behind a single function
 * (or a stateful class, for the 9-step Connect flow).
 */
export { loginOTP, type LoginOTPInput, type OTPHint } from "./loginOtp.js";
export {
  registerApplication,
  type RegisterAppInput,
  type RegisterAppResult,
  type OneTimeSecrets,
} from "./registerApplication.js";
export { connectLogin, type ConnectLoginInput } from "./connectLogin.js";
export { rotateCredential, type RotateCredentialInput } from "./rotateCredential.js";
export { quoteThenExecute } from "./quoteThenExecute.js";
export {
  ConnectPayment,
  newConnectPayment,
  type ConnectPaymentInput,
  type ConnectPaymentResult,
} from "./connectPayment.js";
