const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const path = require('path');
const fs = require('fs');
const rootPath = process.cwd();

const CompressionPlugin = require('compression-webpack-plugin'); //引入gzip压缩插件
// 定义压缩文件类型
const productionGzipExtensions = ['js', 'css'];
const TerserPlugin = require('terser-webpack-plugin');

const configFile = path.join(rootPath, '.demosrc.js');
if (!fs.existsSync(configFile)) {
  throw new Error('No .demosrc.js file found in project.');
}

let configCode = fs.readFileSync(configFile, 'utf-8');
const babel = require('@babel/core');
configCode = babel.transformSync(configCode, { presets: ['@babel/preset-env'] })
  .code;

const requireFromString = require('require-from-string');

let config = requireFromString(configCode);
config = config.default || config;

if (typeof config === 'function') {
  config = config(process.env.NODE_ENV);
}

let port = 3000;
if (config.devServer && config.devServer.port) {
  port = config.devServer.port;
}
let output = config.output || { dir: 'dist' };
let demoList = config.demoList || '.demoList.json';
let demosPath = config.demosPath || 'demos';

if (typeof output === 'string') {
  output = { dir: output };
}

let themeFilePath = path.resolve(__dirname, './src/css/default_theme.scss');

if (config.themeFile) {
  themeFilePath = path.resolve(rootPath, config.themeFile);
}
console.log('Go: config', config);

console.warn(`Output directory: ${output.dir}.`);
console.warn(`PublicUrl: ${output.publicUrl || '/'}.`);

module.exports = {
  entry: path.join(__dirname, 'index.js'),
  output,
  publicFolder: path.join(
    rootPath,
    config.staticFolder || config.publicFolder || 'static'
  ),
  devServer: {
    port
  },
  cache: false,
  envs: {
    NODE_ENV: process.env.NODE_ENV
  },
  babel: {
    babelrc: !!config.babelrc,
    transpileModules: ['@demosify/core']
  },
  chainWebpack(config) {
    config.merge({
      plugin: {
        monaco: {
          plugin: MonacoWebpackPlugin
        }
      },
      node: {
        fs: 'empty'
      },
      resolve: {
        alias: {
          '@': path.join(__dirname, 'src'),
          '~': path.join(rootPath, demosPath),
          demos: path.join(rootPath, demosPath),
          '.demoList.json': path.join(rootPath, demosPath, demoList),
          manifest: path.join(rootPath, '.demosrc'),
          themeFile: themeFilePath
        }
      }
    });
    config.module
      .rule('json')
      .test(/\.json$/)
      .use('json')
      .loader('json-loader')
      .end();
    config.module.rule('json').store.set('type', 'javascript/auto');
    config.output.filename('[name].bundle.js');
  },
  configureWebpack: {
    plugins: [
      new CompressionPlugin({
        filename: '[path].gz[query]',
        algorithm: 'gzip',
        test: new RegExp(`\\.(${productionGzipExtensions.join('|')})$`),
        threshold: 10240,
        minRatio: 0.8
      })
    ],
    optimization: {
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: Infinity,
        minSize: 20000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              // get the name. E.g. node_modules/packageName/not/this/part.js
              // or node_modules/packageName
              const packageName = module.context.match(
                /[\\/]node_modules[\\/](.*?)([\\/]|$)/
              )[1];
              // npm package names are URL-safe, but some servers don't like @ symbols
              return `npm.${packageName.replace('@', '')}`;
            }
          }
        }
      },
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              pure_funcs: ['console.log']
            }
          }
        })
      ]
    }
  }
};
