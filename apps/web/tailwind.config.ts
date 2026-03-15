import type { Config } from "tailwindcss";
import baseConfig from "@tripagent/config/tailwind/base";

const config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [baseConfig as Config],
} satisfies Config;

export default config;
