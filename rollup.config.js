import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/ev-smart-charging-card.js",
  output: {
    file: "dist/ev-smart-charging-card.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [
    resolve(),
    terser({ keep_classnames: true, keep_fnames: true }),
  ],
};
