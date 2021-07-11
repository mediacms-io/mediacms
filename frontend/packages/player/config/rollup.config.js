import rollup_builds from './includes/rollup_builds';
import pckg from '../package.json';

const dists = rollup_builds('./src/index.js', './out', pckg);

export default [dists.browser('./dist/mediacms-player.js')];
