import test from 'ava'
import path from 'path'
import rimraf from 'rimraf'
import AppManifestWebpackPlugin from '..'
import denodeify from 'denodeify'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import dircompare from 'dir-compare'
import packageJson from '../package.json'

const webpack = denodeify(require('webpack'))
const readFile = denodeify(require('fs').readFile)
const writeFile = denodeify(require('fs').writeFile)
const mkdirp = denodeify(require('mkdirp'))

const LOGO_PATH = path.resolve(__dirname, 'fixtures/logo.png')
const compareOptions = { compareSize: true }

let outputIndex = 1

rimraf.sync(path.resolve(__dirname, '../dist'))

function baseWebpackConfig(plugin) {
  return {
    devtool: 'eval',
    entry: path.resolve(__dirname, 'fixtures/entry.js'),
    output: {
      path: path.resolve(__dirname, '../dist', `test-${outputIndex++}`),
    },
    plugins: [].concat(plugin),
  }
}

test('should throw error when called without arguments', async t => {
  t.plan(2)
  let plugin
  try {
    plugin = new AppManifestWebpackPlugin()
  } catch (err) {
    t.is(err.message, 'AppManifestWebpackPlugin options are required')
  }
  t.is(plugin, undefined)
})

test('should take a string as argument', async t => {
  const plugin = new AppManifestWebpackPlugin(LOGO_PATH)
  t.is(plugin.options.logo, LOGO_PATH)
})

test('should take an object with just the logo as argument', async t => {
  const plugin = new AppManifestWebpackPlugin({ logo: LOGO_PATH })
  t.is(plugin.options.logo, LOGO_PATH)
})

test('should generate the expected default result', async t => {
  const stats = await webpack(
    baseWebpackConfig(
      new AppManifestWebpackPlugin({
        logo: LOGO_PATH,
        persistentCache: false,
      }),
    ),
  )
  const outputPath = stats.compilation.compiler.outputPath
  const expected = path.resolve(__dirname, 'fixtures/expected/default')
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions)
  const diffFiles = compareResult.diffSet.filter(diff => diff.state !== 'equal')
  t.is(diffFiles[0], undefined)
})

test('should generate a configured JSON file', async t => {
  const stats = await webpack(
    baseWebpackConfig(
      new AppManifestWebpackPlugin({
        logo: LOGO_PATH,
        emitStats: true,
        persistentCache: false,
        statsFilename: 'iconstats.json',
      }),
    ),
  )
  const outputPath = stats.compilation.compiler.outputPath
  const expected = path.resolve(__dirname, 'fixtures/expected/generate-json')
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions)
  const diffFiles = compareResult.diffSet.filter(diff => diff.state !== 'equal')
  t.is(diffFiles[0], undefined)
})

test('should work together with the html-webpack-plugin', async t => {
  const stats = await webpack(
    baseWebpackConfig([
      new AppManifestWebpackPlugin({
        logo: LOGO_PATH,
        emitStats: true,
        statsFilename: 'iconstats.json',
        persistentCache: false,
      }),
      new HtmlWebpackPlugin(),
    ]),
  )
  const outputPath = stats.compilation.compiler.outputPath
  const expected = path.resolve(__dirname, 'fixtures/expected/generate-html')
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions)
  const diffFiles = compareResult.diffSet.filter(diff => diff.state !== 'equal')
  t.is(diffFiles[0], undefined)
})

test('should not recompile if there is a cache file', async t => {
  const options = baseWebpackConfig([
    new AppManifestWebpackPlugin({
      logo: LOGO_PATH,
      emitStats: false,
      persistentCache: true,
    }),
    new HtmlWebpackPlugin(),
  ])

  // Bring cache file in place
  const cacheFile = 'icons-366a3768de05f9e78c392fa62b8fbb80/.cache'
  const cacheFileExpected = path.resolve(__dirname, 'fixtures/expected/from-cache/', cacheFile)
  const cacheFileDist = path.resolve(__dirname, options.output.path, cacheFile)
  await mkdirp(path.dirname(cacheFileDist))
  const cache = JSON.parse(await readFile(cacheFileExpected))
  cache.version = packageJson.version
  await writeFile(cacheFileDist, JSON.stringify(cache))

  const stats = await webpack(options)
  const outputPath = stats.compilation.compiler.outputPath
  const expected = path.resolve(__dirname, 'fixtures/expected/from-cache')
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions)
  const diffFiles = compareResult.diffSet.filter(diff => diff.state !== 'equal')
  t.is(diffFiles[0], undefined)
})
