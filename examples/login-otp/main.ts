// Example: run the Business OTP login end-to-end.
//
//   ZEAM_DEMO_MOBILE=+27821234567 npx tsx examples/login-otp/main.ts
//
import { createInterface } from "node:readline/promises";
import { Client, Environment } from "@zeammoney/sdk";
import { loginOTP } from "@zeammoney/sdk/recipes";

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_DEMO_MOBILE;
  if (!mobile) throw new Error("set ZEAM_DEMO_MOBILE=+...");

  const client = new Client({ environment: Environment.Production });
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const sess = await loginOTP(client, {
    mobileNumber: mobile,
    async askCode(hint) {
      return rl.question(`OTP sent to ${hint.maskedDestination}. Enter code: `);
    },
  });
  rl.close();

  console.warn(`logged in, fingerprint=${sess.fingerprint} track=${sess.track}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
