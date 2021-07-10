import { Configuration } from 'webpack';

/*const chunksCacheGroups_0 = {
    commons: {
        test: /[\\/]src[\\/]/,
        name: "_commons",
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
};

const chunksCacheGroups_1 = {
    commons: {
        test: /[\\/]src[\\/]/,
        name: "_commons",
        // priority: -10,
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
    vendors: {
        test: /[\\/]node_modules[\\/]/,
        // test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        // test: /[\\/]node_modules[\\/](!MediaCmsPlayer)[\\/]/,
        name: "_vendors",
        // priority: -20,
        chunks: "all",
        enforce: true,
        // reuseExistingChunk: true,
    },
};

const chunksCacheGroups_2 = {
    commons: {
        minChunks: 2,
        // maxInitialRequests: 8, // @note: Tested values from 0 to 10, and changes applied with values 0, 4, 5, 6, 7, 8.
        // minSize: 0,
        name: "_commons",
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
};

const chunksCacheGroups_3 = {
    vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: "_commons",
        priority: 1,
        chunks: "initial",
    },
};*/

export const config: Configuration = {
  mode: 'production',
  optimization: {
    minimize: true,
    runtimeChunk: false,
    splitChunks: {
      chunks: 'all',
      automaticNameDelimiter: '-',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: '_commons',
          priority: 1,
          chunks: 'initial',
        },
      },
    },
  },
};
