
import { getTinyMCE } from 'editor_tiny/loader';
import { component } from './common';
import IframeEmbed from './iframeembed';
import { getString } from 'core/str';

export const getSetup = async () => {
    const [tinyMCE, buttonTitle, menuTitle] = await Promise.all([
        getTinyMCE(),
        getString('insertmedia', component),
        getString('mediacms', component),
    ]);

    return (editor) => {
        const iframeEmbed = new IframeEmbed(editor);

        editor.ui.registry.addButton(component, {
            icon: 'embed',
            tooltip: buttonTitle,
            onAction: () => iframeEmbed.displayDialogue(),
        });

        editor.ui.registry.addMenuItem(component, {
            icon: 'embed',
            text: menuTitle,
            onAction: () => iframeEmbed.displayDialogue(),
        });
    };
};
