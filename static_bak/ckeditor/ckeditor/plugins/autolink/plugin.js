/*
 Copyright (c) 2003-2015, CKSource - Frederico Knabben. All rights reserved.
 For licensing, see LICENSE.md or http://ckeditor.com/license
*/
(function(){var d=/^(https?|ftp):\/\/(-\.)?([^\s\/?\.#-]+\.?)+(\/[^\s]*)?[^\s\.,]$/ig,e=/"/g;CKEDITOR.plugins.add("autolink",{requires:"clipboard",init:function(c){c.on("paste",function(b){var a=b.data.dataValue;b.data.dataTransfer.getTransferType(c)!=CKEDITOR.DATA_TRANSFER_INTERNAL&&!(-1<a.indexOf("<"))&&(a=a.replace(d,'<a href="'+a.replace(e,"%22")+'">$&</a>'),a!=b.data.dataValue&&(b.data.type="html"),b.data.dataValue=a)})}})})();