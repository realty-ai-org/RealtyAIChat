import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { babel } from "@rollup/plugin-babel";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import typescript from "@rollup/plugin-typescript";
import { typescriptPaths } from "rollup-plugin-typescript-paths";
import commonjs from "@rollup/plugin-commonjs";
import livereload from "rollup-plugin-livereload";
import replace from "@rollup/plugin-replace";

const extensions = [".ts", ".tsx"];

const indexConfig = {
  plugins: [
    resolve({ extensions, browser: true }),
    commonjs(),
    replace({
      "process.env.ENVIRONMENT": JSON.stringify("development"),
      preventAssignment: true,
    }),
    babel({
      babelHelpers: "bundled",
      exclude: "node_modules/**",
      presets: ["solid", "@babel/preset-typescript"],
      extensions,
    }),
    postcss({
      plugins: [autoprefixer(), tailwindcss()],
      extract: false,
      modules: false,
      autoModules: false,
      minimize: true,
      inject: false,
    }),
    typescript(),
    typescriptPaths({ preserveExtensions: true }),
    // terser({ output: { comments: false } }),
    // serve({
    //   open: true,
    //   verbose: true,
    //   contentBase: ["dist"],
    //   host: "localhost",
    //   port: 5678,
    // }),
    livereload({ watch: "dist", delay: 1000 }),
  ],
};

const configs = [
  {
    ...indexConfig,
    input: "./src/web.ts",
    output: {
      file: "dist/web.js",
      format: "es",
    },
  },
  {
    ...indexConfig,
    input: "./src/web_path_var.ts",
    output: {
      file: "dist/web_path_var.js",
      format: "es",
    },
  },
];

export default configs;
