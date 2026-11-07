module.exports = (ctx) => {
  const ret = {
    map: ctx.env === 'development' ? ctx.map : false,
    plugins: {
      autoprefixer: {},
    },
  };

  return ret;
};
