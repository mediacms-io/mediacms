
import Modal from 'core/modal';
import ModalRegistry from 'core/modal_registry';
import { component } from './common';

export default class IframeModal extends Modal {
    // Standard class methods if needed
}

// Define static properties outside the class body for compatibility
IframeModal.TYPE = `${component}/iframe_embed_modal`;
IframeModal.TEMPLATE = `${component}/iframe_embed_modal`;

ModalRegistry.register(IframeModal.TYPE, IframeModal, IframeModal.TEMPLATE);
