
import Modal from 'core/modal';
import ModalRegistry from 'core/modal_registry';
import { component } from './common';

export default class IframeModal extends Modal {
    static TYPE = `${component}/iframe_embed_modal`;
    static TEMPLATE = `${component}/iframe_embed_modal`;
}

ModalRegistry.register(IframeModal.TYPE, IframeModal, IframeModal.TEMPLATE);
