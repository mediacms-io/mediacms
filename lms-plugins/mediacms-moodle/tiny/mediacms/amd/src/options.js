
import { component } from './common';

export const register = (editor) => {
    const registerOption = editor.options.register;

    registerOption(`${component}:mediacmsurl`, {
        processor: 'string',
        default: ''
    });

    registerOption(`${component}:launchUrl`, {
        processor: 'string',
        default: ''
    });

    registerOption(`${component}:lti`, {
        processor: 'object',
        default: {}
    });
};

export const getMediaCMSUrl = (editor) => editor.options.get(`${component}:mediacmsurl`);
export const getLaunchUrl = (editor) => editor.options.get(`${component}:launchUrl`);
export const getLti = (editor) => editor.options.get(`${component}:lti`);
