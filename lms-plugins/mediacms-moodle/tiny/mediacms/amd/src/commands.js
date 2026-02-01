
import { getTinyMCE } from 'editor_tiny/loader';
import { component, buttonName } from './common';
import IframeEmbed from './iframeembed';
import { getString } from 'core/str';
import { getButtonImage } from 'editor_tiny/utils';

export const getSetup = async () => {
    const [tinyMCE, buttonTitle, menuTitle, buttonImage] = await Promise.all([
        getTinyMCE(),
        getString('insertmedia', component),
        getString('mediacms', component),
        getButtonImage('icon', component)
    ]);

    return (editor) => {
        const iframeEmbed = new IframeEmbed(editor);
        const action = () => iframeEmbed.displayDialogue();

        // Register icon from pix folder (icon.svg)
        editor.ui.registry.addIcon(buttonName, buttonImage.html);

        editor.ui.registry.addButton(buttonName, {
            icon: buttonName,
            tooltip: buttonTitle,
            onAction: action,
        });

        editor.ui.registry.addMenuItem(buttonName, {
            icon: buttonName,
            text: menuTitle,
            onAction: action,
        });
    };
};
