const merge = require('lodash.merge');

import { ConfigHtml, ConfigPages, ConfigWindow } from '../config';

function validateBoolean(value?: boolean | 0 | 1, defaultValue = false): boolean {

	if (true === value || false === value) {
		return value;
	}

	if (0 === value || 1 === value) {
		return !!value;
	}

	return defaultValue;
}

function validateString(value?: string, defaultValue = ''): string {
	return value ? value : defaultValue;
}

function getArrayType(sourcesArr?: Array<{ [key: string]: string }>, pageArr: Array<{ [key: string]: string }> = []): Array<{ [key: string]: string }> {

	if ((!sourcesArr || !sourcesArr.length) && (!pageArr || !pageArr.length)) {
		return [];
	}

	if (sourcesArr && sourcesArr.length && pageArr && pageArr.length) {
		return sourcesArr.concat(pageArr);
	}

	if (sourcesArr && sourcesArr.length) {
		return sourcesArr;
	}

	return pageArr;
}

function formatPagesConfig(sources: { title: string, filename: string, render: string, html: ConfigHtml, window: ConfigWindow }, pages: ConfigPages): ConfigPages {

	const ret: ConfigPages = {};

	for (const pk in pages) {

		ret[pk] = {
			staticPage: validateBoolean(pages[pk].staticPage, false),
			buildExclude: validateBoolean(pages[pk].buildExclude, false),
			title: validateString(pages[pk].title, sources.title),
			filename: validateString(pages[pk].filename, sources.filename),
			html: {
				head: {
					meta: getArrayType(sources.html.head.meta, pages[pk].html.head.meta),
					links: getArrayType(sources.html.head.links, pages[pk].html.head.links),
					scripts: getArrayType(sources.html.head.scripts, pages[pk].html.head.scripts),
				},
				body: {
					scripts: getArrayType(sources.html.body.scripts, pages[pk].html.body.scripts),
					snippet: validateString(pages[pk].html.body.snippet, sources.html.body.snippet),
				},
			},
			window: merge({}, sources.window, pages[pk].window),
			render: validateString(sources.render, pages[pk].render),
		};
	}

	return ret;
}

export default formatPagesConfig;
