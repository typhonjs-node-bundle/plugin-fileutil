import fs                from 'fs';
import path              from 'path';
import { fileURLToPath } from 'url';

import { cosmiconfig }   from 'cosmiconfig';

import esmLoader         from './esmLoader.js';

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
   `.${moduleName}.json`,
   `.${moduleName}.yaml`,
   `.${moduleName}.yml`,
   `${moduleName}.config.js`,
   `${moduleName}.config.mjs`,
   `${moduleName}.config.cjs`,
   `${moduleName}.config.json`,
   `${moduleName}.config.yaml`,
   `${moduleName}.config.yml`
];

/**
 * Provides a few utility functions to walk the local file tree.
 */
export default class FileUtil
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
    * Convenience method to covert a file URL into the file path of the directory
    *
    * @param {string} url - A file URL
    *
    * @returns {string}
    */
   static getURLDirpath(url)
   {
      return path.dirname(fileURLToPath(url));
   }

   /**
    * Convenience method to convert a file URL into a file path.
    *
    * @param {string} url - A file URL
    *
    * @returns {string}
    */
   static getURLFilepath(url)
   {
      return fileURLToPath(url);
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
    * Uses cosmiconfig to attempt to load a local configuration file based on a module name. Other plugins may
    * provide additional file type support. For instance `@typhonjs-node-rollup/plugin-typescript` provides support for
    * loading Typescript configuration files.
    *
    * The default locations for config file loading given a module name are as follows. This is an exhaustive list.
    *
    * 'package.json',
    * `.${moduleName}rc`,
    * `.${moduleName}rc.json`,
    * `.${moduleName}rc.yaml`,
    * `.${moduleName}rc.yml`,
    * `.${moduleName}rc.js`,
    * `.${moduleName}rc.mjs`,
    * `.${moduleName}rc.cjs`,
    * `.${moduleName}.json`,
    * `.${moduleName}.yaml`,
    * `.${moduleName}.yml`,
    * `${moduleName}.config.js`,
    * `${moduleName}.config.mjs`,
    * `${moduleName}.config.cjs`,
    * `${moduleName}.config.json`,
    * `${moduleName}.config.yaml`,
    * `${moduleName}.config.yml`
    *
    * @param {object}   options
    *
    * @param {string}   options.moduleName - The module name to load a config file.
    *
    * @param {string}   [options.packageName] - The package name for the module loading this configuration file.
    *
    * @param {string[]} [options.mergeExternal=true] - When set to false will not merge any external plugin defined
    *                                                  `searchPlaces`.
    *
    * @param {string[]} [options.searchPlaces] - Explicit list of search places.
    *
    * @returns {Promise<*>}
    */
   static async openConfig(options)
   {
      if (typeof options !== 'object') { throw new TypeError(`'options' is not an 'object'`); }
      if (typeof options.moduleName !== 'string') { throw new TypeError(`'options.moduleName' is not a 'string'`); }

      const moduleName = options.moduleName;
      const packageName = typeof options.packageName === 'string' ? `${options.packageName}: `: '';
      const mergeExternal = typeof options.mergeExternal === 'boolean' ? options.mergeExternal : true;

      // Make a request for any externally provided cosmiconfig plugin support.
      const remoteCosmic = await global.$$eventbus.triggerAsync(
       'typhonjs:oclif:system:file:util:cosmic:support:get', moduleName);

      let mergeCosmic = [];

      // Make sure remote input plugins is structured as an array.
      if (remoteCosmic !== void 0)
      {
         if (!Array.isArray(remoteCosmic)) { mergeCosmic.push(remoteCosmic); }
         else { mergeCosmic = remoteCosmic.flat().filter((entry) => entry !== void 0); }
      }

      // Merge results -------------------

      const searchPlacesMerge = Array.isArray(options.searchPlaces) ? searchPlaces :
       s_DEFAULT_COSMIC_SEARCHPLACES(moduleName);

      let loaders = {
         '.js': esmLoader,
         '.mjs': esmLoader
      };

      // Merge results from externally provided cosmiconfig data (searchPlaces & loaders).
      for (const cosmic of mergeCosmic)
      {
         if (mergeExternal && Array.isArray(cosmic.searchPlaces))
         {
            searchPlacesMerge.push(...cosmic.searchPlaces);
         }

         if (typeof cosmic.loaders === 'object')
         {
            loaders = Object.assign(loaders, cosmic.loaders);
         }
      }

      // Define to cosmiconfig options. Stop at the original CWD.
      const cosmicOptions = {
         stopDir: global.$$bundler_origCWD,
         loaders,
         searchPlaces: searchPlacesMerge
      }

      const explorer = cosmiconfig(moduleName, cosmicOptions);

      let result = null;

      try
      {
         result = await explorer.search(global.$$bundler_baseCWD);
      }
      catch(error)
      {
         global.$$eventbus.trigger('log:error',
          `${packageName}Loading local configuration file for ${moduleName} failed...\n${error.message}`);
      }

      // Potentially return null at this point before formatting the final result.
      if (result === null) { return null; }

      // Normalize the result from cosmiconfig with a little extra data.
      return {
         config: result.config,
         filepath: result.filepath,
         filename: path.basename(result.filepath),
         extension: path.extname(result.filepath).toLowerCase(),
         relativePath: FileUtil.getRelativePath(global.$$bundler_baseCWD, result.filepath)
      }
   }

   /**
    * Opens a local configuration file with additional sanity checking and handling of a provided default config.
    *
    * @param {object}   options
    *
    * @param {string}   options.moduleName - The module name to load a config file.
    *
    * @param {string}   [options.packageName] - The package name for the module loading this configuration file.
    *
    * @param {string}   [options.defaultConfig=null] - The default configuration if loading fails.
    *
    * @param {object}   [options.cliFlags=null] - The CLI flags. Parsed for `--ignore-local-config`
    *
    * @param {string[]} [options.mergeExternal=true] - When set to false will not merge any external plugin defined
    *                                                  `searchPlaces`.
    *
    * @param {string[]} [options.searchPlaces] - Explicit list of search places.
    *
    * @returns {Promise<void>}
    */
   static async safeOpenConfig(options)
   {
      if (typeof options !== 'object') { throw new TypeError(`'options' is not an 'object'`); }
      if (typeof options.moduleName !== 'string') { throw new TypeError(`'options.moduleName' is not a 'string'`); }

      const moduleName = options.moduleName;
      const defaultConfig = typeof options.defaultConfig === 'object' ? options.defaultConfig : null;
      const packageName = typeof options.packageName === 'string' ? `${options.packageName}: `: '';
      const cliFlags = typeof options.cliFlags === 'object' ? `${options.cliFlags}: `: {};

      // Handle ignoring loading local config files if the CLI flag `--ignore-local-config` is true.
      if (typeof cliFlags['ignore-local-config'] === 'boolean' && cliFlags['ignore-local-config'])
      {
         return defaultConfig;
      }

      const result = await FileUtil.openConfig(options);

      if (result !== null)
      {
         if (typeof result.config === 'object')
         {
            if (Object.keys(result.config).length === 0)
            {
               global.$$eventbus.trigger('log:warn', `${packageName}Local ${moduleName} configuration file `
              + `empty using default config:\n${result.relativePath}`);

               return defaultConfig;
            }

            global.$$eventbus.trigger('log:verbose',
             `${packageName}Deferring to local ${moduleName} configuration file.\n${result.relativePath}`);

            return result.config;
         }
         else
         {
            global.$$eventbus.trigger('log:warn', `${packageName}Local ${moduleName} configuration file `
           + `malformed using default config; expected an 'object':\n${result.relativePath}`);

            return defaultConfig;
         }
      }

      return defaultConfig;
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
      eventbus.on(`typhonjs:oclif:system:file:util:url:path:dir:get`, FileUtil.getURLDirpath, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:url:path:file:get`, FileUtil.getURLFilepath, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:config:babel:has`, FileUtil.hasBabelConfig, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:config:typescript:has`, FileUtil.hasTscConfig, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:is:js`, FileUtil.isJS, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:is:ts`, FileUtil.isTS, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:config:open`, FileUtil.openConfig, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:config:open:safe`, FileUtil.safeOpenConfig, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:dir:walk`, FileUtil.walkDir, FileUtil);
      eventbus.on(`typhonjs:oclif:system:file:util:files:walk`, FileUtil.walkFiles, FileUtil);
   }
}
