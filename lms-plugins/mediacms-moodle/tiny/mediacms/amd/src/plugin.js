
import { getTinyMCE } from 'editor_tiny/loader';
import { getPluginMetadata } from 'editor_tiny/utils';
import { component, pluginName } from './common';
import * as Commands from './commands';
import * as Options from './options';
import * as Configuration from './configuration';

export default new Promise(async (resolve) => {
    const [tinyMCE, setupCommands, pluginMetadata] = await Promise.all([
        getTinyMCE(),
        Commands.getSetup(),
        getPluginMetadata(component, pluginName),
    ]);

    tinyMCE.PluginManager.add(`${component}/plugin`, (editor) => {
        Options.register(editor);
        setupCommands(editor);
        return pluginMetadata;
    });

    resolve([`${component}/plugin`, Configuration]);
});
