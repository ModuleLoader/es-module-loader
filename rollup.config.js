process.env.loader = process.env.loader || 'system-register';

export default {
  entry: `loader-${process.env.loader}.js`,
  format: 'umd',
  moduleName: `${('Loader-' + process.env.loader).replace(/-./g, (part) => part[1].toUpperCase())}`,
  dest: `dist/loader-${process.env.loader}.js`,

  // skip rollup warnings (specifically the eval warning)
  onwarn: function() {}
};