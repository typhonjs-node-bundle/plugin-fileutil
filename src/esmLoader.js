/**
 * Uses dynamic import to load a configuration file.
 *
 * @param filePath
 *
 * @returns {Promise<boolean>}
 */
module.exports = async (filePath) => {
   const module = await import(filePath);
   return module.default;
};