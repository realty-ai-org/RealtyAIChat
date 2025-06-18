import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { babel } from "@rollup/plugin-babel";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import typescript from "@rollup/plugin-typescript";
import { typescriptPaths } from "rollup-plugin-typescript-paths";
import commonjs from "@rollup/plugin-commonjs";
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
    terser({
      mangle: {
        nth_identifier: {
          get: (n) => {
            // prettier-ignore
            const leading = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_".split("");
            const digits = "0123456789".split("");
            frequency = new Map();
            leading.forEach(function (ch) {
              frequency.set(ch, 0);
            });
            digits.forEach(function (ch) {
              frequency.set(ch, 0);
            });

            function mergeSort(array, cmp) {
              if (array.length < 2) return array.slice();
              function merge(a, b) {
                var r = [],
                  ai = 0,
                  bi = 0,
                  i = 0;
                while (ai < a.length && bi < b.length) {
                  cmp(a[ai], b[bi]) <= 0
                    ? (r[i++] = a[ai++])
                    : (r[i++] = b[bi++]);
                }
                if (ai < a.length) r.push.apply(r, a.slice(ai));
                if (bi < b.length) r.push.apply(r, b.slice(bi));
                return r;
              }
              function _ms(a) {
                if (a.length <= 1) return a;
                var m = Math.floor(a.length / 2),
                  left = a.slice(0, m),
                  right = a.slice(m);
                left = _ms(left);
                right = _ms(right);
                return merge(left, right);
              }
              return _ms(array);
            }

            function compare(a, b) {
              return frequency.get(b) - frequency.get(a);
            }
            chars = mergeSort(leading, compare).concat(
              mergeSort(digits, compare)
            );

            const prefix = "rai_";
            var ret = "",
              base = 54;
            n++;
            do {
              n--;
              ret += chars[n % base];
              n = Math.floor(n / base);
              base = 64;
            } while (n > 0);
            return prefix + ret;
          },
        },
      },
      output: {
        comments: false,
      },
      compress: {
        drop_console: ["log"],
      },
    }),
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
