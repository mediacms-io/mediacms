function bodySnippet(id:string) {
	return '<div id="' + id + '"></div>';
}

interface ConfigHtmlHead{
	meta?: { [key: string]: string }[],
	links?: { [key: string]: string }[],
	scripts?: { [key: string]: string }[],
}

interface ConfigHtmlBody{
	scripts: { [key: string]: string }[],
	snippet: string,
}

export interface ConfigHtml{
	head: ConfigHtmlHead,
	body: ConfigHtmlBody,
}

export interface ConfigPages{
	[key: string]: ConfigPage
}

export interface ConfigWindow{
	[key: string ]: unknown 
}

export interface ConfigType {
	src: string,
	build: string,
	html: ConfigHtml,
	pages: ConfigPages,
	window: ConfigWindow,
	postcssConfigFile: string,
}

export interface ConfigPage{
	staticPage: boolean,
	buildExclude: boolean,
	title: string,
	filename: string,
	html: ConfigHtml,
	window: ConfigWindow,
	render: string,
}

const homePage: ConfigPage = {
	staticPage: true,
	buildExclude: false,
	title: 'Home',
	filename: 'index.html',
	html: {
		head: {},
		body: {
			scripts: [],
			snippet: bodySnippet('page-home'),
		}
	},
	window: {},
	render: 'import { renderPage } from \'./js/helpers\'; import { HomePage } from \'./js/pages/HomePage\'; renderPage( \'page-home\', HomePage );',
};

const errorPage: ConfigPage = {
	staticPage: true,
	buildExclude: false,
	title: 'Error',
	filename: 'error.html',
	html: {
		head: {},
		body: {
			scripts: [],
			snippet: bodySnippet('page-error'),
		}
	},
	window: {},
	render: 'import { renderPage } from \'./js/helpers\'; import { ErrorPage } from \'./js/pages/ErrorPage\'; renderPage( \'page-error\', ErrorPage );',
};

const pages: { [key: string]: ConfigPage } = {
	home: homePage,
	error: errorPage,
};

const htmlHead: ConfigHtmlHead =  {
	meta: [
		{ charset: 'utf-8' },
		{ content: 'ie=edge', 'http-equiv': 'x-ua-compatible' },
		{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
	],
	links: [],
	scripts: [],
};

const htmlBody: ConfigHtmlBody =  {
	scripts: [],
	snippet: '',
};

const html: ConfigHtml = {
	head: htmlHead,
	body: htmlBody,
};

export const config : ConfigType = {
	src: '',
	build: '',
	pages,
	html,
	window: {},
	postcssConfigFile: '',
};

export default config;