const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const templatesPath = path.join(__dirname, './templates');
const staticTemplatesPath = path.join(__dirname, './templates/static');

const compileTmpl = (filename) =>
  ejs.compile(fs.readFileSync(path.join(templatesPath, filename), 'utf8'), {
    root: [templatesPath],
    filename: path.join(templatesPath, filename),
    outputFunctionName: 'echo',
  });

const compileStaticTmpl = (filename) =>
  ejs.compile(fs.readFileSync(path.join(staticTemplatesPath, filename), 'utf8'), {
    root: [staticTemplatesPath],
    filename: path.join(staticTemplatesPath, filename),
    outputFunctionName: 'echo',
  });

module.exports = {
  htmlBodySnippet: compileTmpl('htmlBodySnippet.ejs'),
  htmlBodySnippetEmbedPage: compileTmpl('htmlBodySnippetEmbedPage.ejs'),
  htmlBodySnippetAddMediaPage: compileTmpl('htmlBodySnippetAddMediaPage.ejs'),
  renderBase: compileTmpl('renderBase.ejs'),
  renderPageContent: compileTmpl('renderPageContent.ejs'),
  renderPageStaticContent: compileTmpl('renderPageStaticContent.ejs'),
  renderEmbedPageContent: compileTmpl('renderEmbedPageContent.ejs'),
  renderAddMediaPageContent: compileTmpl('renderAddMediaPageContent.ejs'),
  static: {
    errorPage: compileStaticTmpl('errorPage.html'),
    aboutPage: compileStaticTmpl('aboutPage.html'),
    termsPage: compileStaticTmpl('termsPage.html'),
    contactPage: compileStaticTmpl('contactPage.html'),
    signinPage: compileStaticTmpl('signinPage.html'),
    signoutPage: compileStaticTmpl('signoutPage.html'),
    registerPage: compileStaticTmpl('registerPage.html'),
    resetPasswordPage: compileStaticTmpl('resetPasswordPage.html'),
    editMediaPage: compileStaticTmpl('editMediaPage.html'),
    editChannelPage: compileStaticTmpl('editChannelPage.html'),
    editProfilePage: compileStaticTmpl('editProfilePage.html'),
    addMediaPageTemplate: compileStaticTmpl('addMediaPageTemplate.html'),
  },
};
