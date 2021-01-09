const fs                = require("fs");
const path              = require("path");

const { cosmiconfig }   = require('cosmiconfig');

const esmLoader         = require('./esmLoader');

const s_EXT_JS = new Map([['.js', 1], ['.jsx', 1], ['.es6', 1], ['.es', 1], ['.mjs', 1]]);
const s_EXT_TS = new Map([['.ts', 1], ['.tsx', 1]]);

const s_BABEL_CONFIG = new Map([['.babelrc', 1], ['.babelrc.cjs', 1], ['.babelrc.js', 1], ['.babelrc.mjs', 1],
 ['.babelrc.json', 1], ['babel.config.cjs', 1], ['babel.config.js', 1], ['babel.config.json', 1],
  ['babel.config.mjs', 1]]);

const s_TSC_CONFIG = new Map([['tsconfig.json', 1], ['jsconfig.json', 1]]);

/**
 * Defines the default configuration file locations `cosmiconfig`.
 *
 * @param {string}   moduleName - The module name to build the default locations.
 *
 * @returns {string[]}
 */
const s_DEFAULT_COSMIC_SEARCHPLACES = (moduleName) => [
   'package.json',
   `.${moduleName}rc`,
   `.${moduleName}rc.json`,
   `.${moduleName}rc.yaml`,
   `.${moduleName}rc.yml`,
   `.${moduleName}rc.js`,
   `.${moduleName}rc.mjs`,
   `.${moduleName}rc.cjs`,
   `${moduleName}.config.js`,
   `${moduleName}.config.mjs`,
   `${moduleName}.config.cjs`,
];

/**
 * Provides a few utility functions to walk the local file tree.
 */
class FileUtil
{
   /**
    * Returns an array of all directories found from walking the directory tree provided.
    *
    * @param {string}   dir - Directory to walk.
    * @param {Array}    [skipDir] - An array of directory names to skip walking.
    * @param {Array}    [results] - Output array.
    *
    * @returns {Promise<Array>}
    */
   static async getDirList(dir = '.', skipDir = [], results = [])
   {
      for await (const p of FileUtil.walkDir(dir, skipDir))
      {
         results.push(path.resolve(p));
      }

      return results;
   }

   /**
    * Returns an array of all files found from walking the directory tree provided.
    *
    * @param {string}   dir - Directory to walk.
    * @param {Array}    [skipDir] - An array of directory names to skip walking.
    * @param {Array}    [results] - Output array.
    *
    * @returns {Promise<Array>}
    */
   static async getFileList(dir = '.', skipDir = [], results = [])
   {
      for await (const p of FileUtil.walkFiles(dir, skipDir))
      {
         results.push(path.resolve(p));
      }

      return results;
   }

   /**
    * Given a base path and a file path this method will return a relative path if the file path includes the base
    * path otherwise the full absolute file path is returned.
    *
    * @param basePath
    * @param filePath
    *
    * @returns {string|string}
    */
   static getRelativePath(basePath, filePath)
   {
      let returnPath = filePath;

      // Get the relative path and append `./` if necessary.
      if (filePath.startsWith(basePath))
      {
         returnPath = path.relative(basePath, filePath);
         returnPath = returnPath.startsWith('.') ? returnPath : `.${path.sep}${returnPath}`;
      }

      return returnPath;
   }

   /**
    * Searches all files from starting directory skipping any directories in `skipDir` and those starting with `.`
    * in an attempt to locate a Babel configuration file. If a Babel configuration file is found `true` is
    * immediately returned.
    *
    * @param {string}   dir - Directory to walk.
    * @param {Array}    [skipDir] - An array of directory names to skip walking.
    *
    * @returns {Promise<boolean>} Whether a Babel configuration file was found.
    */
   static async hasBabelConfig(dir = '.', skipDir = [])
   {
      for await (const p of FileUtil.walkFiles(dir, skipDir))
      {
         if (s_BABEL_CONFIG.has(path.basename(p)))
         {
            return true;
         }
      }
      return false;
   }

   /**
    * Searches all files from starting directory skipping any directories in `skipDir` and those starting with `.`
    * in an attempt to locate a Typescript configuration file. If a configuration file is found `true` is
    * immediately returned.
    *
    * @param {string}   dir - Directory to walk.
    * @param {Array}    [skipDir] - An array of directory names to skip walking.
    *
    * @returns {Promise<boolean>} Whether a Typescript configuration file was found.
    */
   static async hasTscConfig(dir = '.', skipDir = [])
   {
      for await (const p of FileUtil.walkFiles(dir, skipDir))
      {
         if (s_TSC_CONFIG.has(path.basename(p)))
         {
            return true;
         }
      }
      return false;
   }

   /**
    * Tests if the given extension is a Javascript file extension type.
    *
    * @param {string}   extension - extension to test.
    *
    * @returns {boolean} True if JS extension type.
    */
   static isJS(extension)
   {
      return s_EXT_JS.has(extension);
   }

   /**
    * Tests if the given extension is a Typescript file extension type.
    *
    * @param {string}   extension - extension to test.
    *
    * @returns {boolean} True if TS extension type.
    */
   static isTS(extension)
   {
      return s_EXT_TS.has(extension);
   }

   /**
    * Attempts to open `basePath/baseFileName[extensions]` until a file attempts to loads (success or fail).
    *
    * @param {string}   basePath - The base file path.
    * @param {string}   baseFileName - The base file name without extension.
    * @param {string[]} extensions - An array of extensions to attach to `baseFileName`.
    * @param {string}   [errorMessage] - A message to prefix to any generated errors.
    *
    * @returns {null|{absFilePath: string, extension: *, fileName: string, data: *, relativePath, baseFileName}}
    */
   static async openFiles(basePath, baseFileName, extensions = [], errorMessage = '')
   {
      for (const extension of extensions)
      {
         const fileName = `${baseFileName}${extension}`;
         const absFilePath = `${basePath}${path.sep}${fileName}`;
         const relativePath = FileUtil.getRelativePath(global.$$bundler_baseCWD, absFilePath)

         const fileInfo = {
            absFilePath,
            baseFileName,
            extension,
            fileName,
            relativePath
         }

         if (fs.existsSync(absFilePath))
         {
            try
            {
               // Attempt require; it will fail for ESM imports, but work for CJS / JSON.
               return Object.assign(fileInfo, { data: require(absFilePath) });
            }
            catch(err)
            {
               try
               {
                  const module = await import(absFilePath);
                  return Object.assign(fileInfo, { data: module.default });
               }
               catch (errESM)
               {
                  global.$$eventbus.trigger('log:warn', `${errorMessage}\nrequire error: ${err.message}\n`
                 + `dynamic import error: ${errESM.message}\n`
                  + `file path: ${FileUtil.getRelativePath(global.$$bundler_origCWD, absFilePath)}`);
               }
            }

            // Loading has failed, so don't attempt any more extensions.
            break;
         }
      }

      return null;
   }

   /**
    * Attempts to open local configuration files first in the modified CWD if applicable before the original CWD.
    *
    * @param {string}   baseFileName - The base file name without extension.
    * @param {string[]} extensions - An array of extensions to attach to `baseFileName`.
    * @param {string}   [errorMessage] - A message to prefix to any generated errors.
    *
    * @returns {{absFilePath: string, extension: *, fileName: string, data: *, relativePath, baseFileName}|null}
    */
   static async openLocalConfigs(baseFileName, extensions = [], errorMessage = '')
   {
      // Attempt to load from new CWD path if it is not the original CWD.
      if (global.$$bundler_baseCWD !== global.$$bundler_origCWD)
      {
         const data = await FileUtil.openFiles(global.$$bundler_baseCWD, baseFileName, extensions, errorMessage);

         // Early out as we found the config on the base CWD which is modified from the original CWD.
         if (data !== null) { return data; }
      }

      // Attempt to load from original CWD path.
      return FileUtil.openFiles(global.$$bundler_origCWD, baseFileName, extensions, errorMessage);
   }

   /**
    *
    * @param options
    * @returns {Promise<*>}
    */
   static async openLocalCosmic(options)
   {
      if (typeof options !== 'object') { throw new TypeError(`'options' is not an 'object'`); }
      if (typeof options.moduleName !== 'string') { throw new TypeError(`'options.moduleName' is not a 'string'`); }

      const moduleName = options.moduleName;

      const remoteCosmic = await global.$$eventbus.triggerAsync(
       'typhonjs:oclif:system:file:util:cosmic:support:get', moduleName);

      let mergeCosmic = [];

      // Make sure remote input plugins is structured as an array.
      if (remoteCosmic !== void 0)
      {
         if (!Array.isArray(remoteCosmic)) { mergeCosmic.push(remoteCosmic); }
         else { mergeCosmic = remoteCosmic.flat().filter((entry) => entry !== void 0); }
      }

      process.stderr.write(`!!! FileUtil - openLocalCosmic - mergeCosmic: ${JSON.stringify(mergeCosmic)}\n`);

      const searchPlacesMerge = Array.isArray(options.searchPlaces) ? searchPlaces :
       s_DEFAULT_COSMIC_SEARCHPLACES(moduleName);

      let loaders = {
         '.js': esmLoader,
         '.mjs': esmLoader
      };

      for (const cosmic of mergeCosmic)
      {
         if (Array.isArray(cosmic.searchPlaces))
         {
            searchPlacesMerge.push(...cosmic.searchPlaces);
         }

         if (typeof cosmic.loaders === 'object')
         {
            loaders = Object.assign(loaders, cosmic.loaders);
         }
      }

      const cosmicOptions = {
         stopDir: global.$$bundler_origCWD,
         loaders,
         searchPlaces: searchPlacesMerge
      }

process.stderr.write(`!!! FileUtil - openLocalCosmic - options: ${JSON.stringify(cosmicOptions)}\n`);

      const explorer = cosmiconfig(moduleName, cosmicOptions);

process.stderr.write(`!!! FileUtil - openLocalCosmic - baseCWD: ${global.$$bundler_baseCWD}\n`);

      return await explorer.search(global.$$bundler_baseCWD);
   }

   /**
    * A generator function that walks the local file tree.
    *
    * @param {string}   dir - The directory to start walking.
    * @param {Array}    [skipDir] - An array of directory names to skip walking.
    *
    * @returns {any}
    */
   static async * walkDir(dir, skipDir = [])
   {
      const skipDirMap = new Map(skipDir.map((entry) => { return [entry, 1]; }));

      for await (const d of await fs.promises.opendir(dir))
      {
         // Skip directories in `skipMap` or any hidden directories (starts w/ `.`).
         if (d.isDirectory() && (skipDirMap.has(d.name) || d.name.startsWith('.')))
         {
            continue;
         }

         const entry = path.join(dir, d.name);

         if (d.isDirectory())
         {
            yield entry;
            yield* FileUtil.walkDir(entry);
         }
      }
   }

   /**
    * A generator function that walks the local file tree.
    *
    * @param {string}   dir - The directory to start walking.
    * @param {Array}    skipDir - An array of directory names to skip walking.
    *
    * @returns {any}
    */
   static async * walkFiles(dir, skipDir = [])
   {
      const skipDirMap = new Map(skipDir.map((entry) => { return [entry, 1]; }));

      for await (const d of await fs.promises.opendir(dir))
      {
         // Skip directories in `skipMap` or any hidden directories (starts w/ `.`).
         if (d.isDirectory() && (skipDirMap.has(d.name) || d.name.startsWith('.')))
         {
            continue;
         }

         const entry = path.join(dir, d.name);

         if (d.isDirectory())
         {
            yield* FileUtil.walkFiles(entry);
         }
         else if (d.isFile())
         {
            yield entry;
         }
      }
   }

   /**
    * Wires up FlagHandler on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    *
    * @see https://www.npmjs.com/package/typhonjs-plugin-manager
    *
    * @ignore
    */
   static onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      eventbus.on(`typhonjs:oclif:system:file:util:list:dir:get`, FileUtil.getDirList, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:list:file:get`, FileUtil.getFileList, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:path:relative:get`, FileUtil.getRelativePath, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:config:babel:has`, FileUtil.hasBabelConfig, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:config:typescript:has`, FileUtil.hasTscConfig, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:is:js`, FileUtil.isJS, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:is:ts`, FileUtil.isTS, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:files:open`, FileUtil.openFiles, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:configs:local:open`, FileUtil.openLocalConfigs, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:cosmic:local:open`, FileUtil.openLocalCosmic, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:dir:walk`, FileUtil.walkDir, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:files:walk`, FileUtil.walkFiles, FileUtil);
   }
}

module.exports = FileUtil;